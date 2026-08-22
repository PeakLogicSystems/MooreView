'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const { DEFAULT_PORT, DATA_DIR, ST_DIR } = require('./src/config');
const { ensureUserImportsDir } = require('./src/hmi/hmiUserAssets');
const persistence = require('./src/persistence');
const { sanitizeLegacyProjectHwDefaultsOnDisk } = require('./src/settings/portableSettings');
const { TagStore } = require('./src/tags/tagStore');
const { DriverManager } = require('./src/drivers');
const { ScanEngine, shouldAutoStartRuntime } = require('./src/runtime/scanEngine');
const { GraphHistory } = require('./src/runtime/graphHistory');
const { createExpressApi } = require('./src/api/expressRouter');
const { setTagStore } = require('./src/cameras/cameraAiHolder');
const { createPageRoutes } = require('./src/routes/pages');
const { createHmiAssetRedirect } = require('./src/routes/staticAssets');
const programStore = require('./src/programs/programStore');
const { ensureProgramTags } = require('./src/programs/ensureProgramTags');
const mongoTagLogger = require('./src/logger/mongoTagLogger');
const { registry } = require('./src/parc/deviceRegistry');
const { getMqttCentralHub } = require('./src/parc/mqttCentralHub');
const { startPdmBatchScheduler } = require('./src/pdm/pdmBatchScheduler');
const { setBatchScheduler } = require('./src/api/routes/pdmSchedulerHolder');
const { attachLiveWebSocket } = require('./src/live/liveWebSocket');

const PRODUCT = process.env.MOOREVIEW_PRODUCT || 'mvp-suite';

const tagStore = new TagStore();
const driverManager = new DriverManager(tagStore);
const graphHistory = new GraphHistory();
const scanEngine = new ScanEngine(tagStore, driverManager, graphHistory);
const { registerParcRecoveryDeps } = require('./src/parc/parcDeviceRecovery');
registerParcRecoveryDeps({ scanEngine, driverManager });
getMqttCentralHub(registry).setGlobalMirrorDeps({ tagStore });

const { version: APP_VERSION } = require('./package.json');
const publicRoot = path.join(__dirname, 'public');

const app = express();
app.use(express.json({ limit: '12mb' }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const { attachSession, requireAuth } = require('./src/tenants/authMiddleware');
const { sysLogRequestContext } = require('./src/api/middleware/sysLogContext');
const mongoSysLog = require('./src/logger/mongoSysLog');

app.use(attachSession);
app.use(sysLogRequestContext);
mongoSysLog.installProcessHandlers();

function resolveDeployment() {
  try {
    const { isCloudDeployment } = require('./src/cloud/agentProtocol');
    if (isCloudDeployment()) return 'cloud';
  } catch { /* ignore */ }
  return 'appliance';
}

const DEPLOYMENT = resolveDeployment();

if (DEPLOYMENT === 'cloud') {
  try {
    require('./src/tenants/tenantStore'); // seed demo org/users
  } catch (e) {
    console.warn('[tenants] seed:', e.message || e);
  }

  app.get('/health', (req, res) => {
    res.json({
      ok: true,
      app: 'MooreVIEW',
      product: PRODUCT,
      version: APP_VERSION,
      deployment: 'cloud',
      role: 'saas',
      studio: true,
      multiTenant: true,
      tenantId: req.mvAuth?.tenant?.tenantId || process.env.MOOREVIEW_TENANT_ID || null,
      runtime: scanEngine.status(),
      dataDir: DATA_DIR,
      stDir: ST_DIR,
    });
  });

  app.get('/login', (req, res) => {
    if (req.mvAuth) return res.redirect('/');
    const showDemoLogin = process.env.NODE_ENV !== 'production'
      || String(process.env.MOOREVIEW_SHOW_DEMO_LOGIN || '').trim() === '1';
    res.render('cloud-login', { assetV: APP_VERSION, appVersion: APP_VERSION, showDemoLogin });
  });

  app.use((req, res, next) => {
    if (req.path === '/login' || req.path === '/health') return next();
    if (req.path.startsWith('/api/')) return next();
    if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|map)$/i.test(req.path)) return next();
    if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/hmi/')) return next();
    return requireAuth(req, res, next);
  });
} else {
  try {
    require('./src/auth/applianceAuthStore'); // seed local tenant users
  } catch (e) {
    console.warn('[auth] seed:', e.message || e);
  }

  app.get('/health', (req, res) => {
    res.json({
      ok: true,
      app: 'MooreVIEW',
      product: PRODUCT,
      version: APP_VERSION,
      deployment: 'appliance',
      role: 'appliance',
      studio: true,
      singleTenant: true,
      tenantId: 'local',
      user: req.mvAuth?.user?.email || null,
      runtime: scanEngine.status(),
      dataDir: DATA_DIR,
      stDir: ST_DIR,
    });
  });

  app.get('/login', (req, res) => {
    if (req.mvAuth) return res.redirect('/');
    res.render('appliance-login', { assetV: APP_VERSION, appVersion: APP_VERSION });
  });

  app.use((req, res, next) => {
    if (req.path === '/login' || req.path === '/health') return next();
    if (req.path.startsWith('/api/')) return next();
    if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|map|webmanifest)$/i.test(req.path)) return next();
    if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/hmi/')) return next();
    if (req.path.startsWith('/icons/') || req.path.startsWith('/vendor/')) return next();
    return requireAuth(req, res, next);
  });
}

app.use(createHmiAssetRedirect(publicRoot));
ensureUserImportsDir(DATA_DIR);
app.use((req, res, next) => {
  if (/^\/js\/.+\.js$/i.test(req.path) || /^\/css\/.+\.css$/i.test(req.path)) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  }
  next();
});
app.use('/hmi/user', express.static(path.join(DATA_DIR, 'hmi-imports'), { fallthrough: false }));
app.use(express.static(publicRoot));

app.use(createPageRoutes({ appVersion: APP_VERSION, product: PRODUCT, deployment: DEPLOYMENT }));
try {
  if (DEPLOYMENT === 'cloud') {
    const { createCloudStudioPages } = require('./src/routes/cloudStudioPages');
    app.use(createCloudStudioPages({ appVersion: APP_VERSION, product: PRODUCT }));
  }
} catch (e) {
  console.warn('[cloud-studio] pages:', e.message || e);
}
app.use('/api', createExpressApi({ tagStore, driverManager, scanEngine, graphHistory }));
setTagStore(tagStore);

async function boot() {
  console.log('[boot] MooreVIEW starting…');
  persistence.ensureDataDir();
  if (await sanitizeLegacyProjectHwDefaultsOnDisk(persistence)) {
    console.log('[boot] removed legacy project RTU defaults from data files');
  }
  try {
    require('./scripts/ensure-bundled-projects').ensureBundledProjects();
  } catch (e) {
    console.warn('[boot] bundled projects:', e.message || e);
  }
  try {
    const { applyStartupOnBoot } = require('./src/project/startupLoader');
    const startupResult = await applyStartupOnBoot({ tagStore, driverManager, scanEngine, graphHistory });
    if (startupResult.loaded) {
      console.log(`[startup] loaded ${startupResult.mode}${startupResult.name ? `: ${startupResult.name}` : ''}`);
    } else if (startupResult.reason || startupResult.error) {
      console.warn('[startup]', startupResult.reason || startupResult.error);
    }
  } catch (e) {
    console.warn('[startup]', e.message || e);
  }
  try {
    const { initMongoServicesFromSettings } = require('./src/logger/mongoServicesInit');
    await initMongoServicesFromSettings();
  } catch (e) {
    console.warn('[boot] MongoDB services:', e.message || e);
  }
  programStore.migrateLegacyProgram();
  try {
    const activeSrc = programStore.readActive();
    if (String(activeSrc || '').trim()) {
      const { added } = ensureProgramTags(tagStore, activeSrc);
      if (added.length) {
        const preview = added.slice(0, 10).join(', ');
        console.log(`[tags] ensured ${added.length} program tag(s): ${preview}${added.length > 10 ? '…' : ''}`);
      }
    }
  } catch (e) {
    console.warn('[tags] ensure program tags:', e.message || e);
  }
  const settings = persistence.readJson('settings.json', {});
  const deployment = resolveDeployment();
  const product = process.env.MOOREVIEW_PRODUCT || 'mvp-suite';
  const envPort = Number(process.env.PORT || process.env.MOOREVIEW_PORT) || 0;
  let port;
  if (envPort > 0) {
    port = envPort;
  } else if (deployment === 'cloud' && product === 'cloud') {
    // Multi-tenant SaaS — never fall back to settings.json port (often 3090 from Studio exports)
    port = 3100;
  } else {
    const cloudDefault = deployment === 'cloud' ? 3100 : DEFAULT_PORT;
    port = settings.port || cloudDefault;
  }
  if (settings.graphMaxPoints) graphHistory.setMaxPoints(settings.graphMaxPoints);
  scanEngine.loadSettings();

  const httpServer = await new Promise((resolve, reject) => {
    const server = app.listen(port, '0.0.0.0');
    server.once('listening', () => {
      try {
        fs.writeFileSync(path.join(DATA_DIR, 'mooreview.pid'), String(process.pid), 'utf8');
      } catch { /* ignore */ }
      resolve(server);
    });
    server.once('error', (err) => {
      if (err?.code === 'EADDRINUSE') {
        reject(new Error(
          `Port ${port} is already in use — run "npm stop" in est-pc, then "npm start"`,
        ));
      } else {
        reject(err);
      }
    });
  });
  attachLiveWebSocket(httpServer, { tagStore, driverManager, scanEngine, graphHistory });
  const label = resolveDeployment() === 'cloud' ? 'Cloud Studio' : 'MVP Suite';
  console.log(`MooreVIEW ${label}  http://127.0.0.1:${port}`);
  console.log(`Data: ${DATA_DIR}`);
  console.log(`ST programs: ${ST_DIR}`);

  if (settings.mongoLogger?.uri) {
    try {
      await mongoTagLogger.setConfig(settings.mongoLogger);
      await mongoSysLog.setConfig(settings.mongoLogger);
    } catch (e) {
      console.warn('[mongo] startup connect:', e.message || e);
    }
  }
  try {
    await driverManager.rebuild();
  } catch (e) {
    console.warn('[drivers] rebuild at startup:', e.message || e);
  }
  if (settings.remoteExecution === true || settings.mqttParc?.enabled !== false) {
    const {
      stripParcNoiseDrivers,
      pruneParcRegistryNoise,
      reconcileMqttParcDriversFromRegistry: reconcileParc,
    } = require('./src/devices/bulkAddParcOpta');
    const pruned = pruneParcRegistryNoise(registry);
    if (pruned.removed?.length) {
      console.log(`[parc] pruned registry noise: ${pruned.removed.join(', ')}`);
    }
    const stripped = stripParcNoiseDrivers(driverManager.configs);
    let configs = stripped.drivers;
    if (stripped.changed) {
      console.log(`[drivers] stripped mqtt_parc noise: ${stripped.removed.join(', ')}`);
    }
    const rec = reconcileParc(configs, registry);
    configs = rec.drivers;
    if (stripped.changed || rec.changed) {
      driverManager.save(configs);
      try {
        await driverManager.rebuild();
        if (rec.changed) {
          console.log(`[drivers] reconciled mqtt_parc from Parc registry: ${rec.added.join(', ')}`);
        }
      } catch (e) {
        console.warn('[drivers] rebuild after Parc reconcile:', e.message || e);
      }
    }
  }
  const remoteBoot = settings.remoteExecution === true && settings.mqttParc?.enabled !== false;
  const mqttHub = getMqttCentralHub(registry);
  if (remoteBoot) {
    try {
      await mqttHub.start(settings.mqttParc);
      if (mqttHub.isLive()) {
        console.log('[mqtt-parc] central hub connected');
      } else {
        console.warn('[mqtt-parc] hub enabled but not connected — check Mosquitto and mqttParc.brokerUrl');
      }
    } catch (e) {
      console.warn('[mqtt-parc] hub start:', e.message || e);
    }
  }
  if (shouldAutoStartRuntime(settings, driverManager.configs)) {
    try {
      await scanEngine.start();
      console.log('[boot] runtime started (driver polling + historian)');
    } catch (e) {
      const detail = e.errors?.length ? e.errors.join('; ') : (e.message || String(e));
      console.warn('[boot] runtime auto-start:', detail);
    }
  }
  if (!remoteBoot && settings.mqttParc?.enabled) {
    try {
      await mqttHub.start(settings.mqttParc);
      if (mqttHub.isLive()) {
        console.log('[mqtt-parc] central hub connected');
      } else {
        console.warn('[mqtt-parc] hub enabled but not connected — check Mosquitto and mqttParc.brokerUrl');
      }
    } catch (e) {
      console.warn('[mqtt-parc] hub start:', e.message || e);
    }
  }
  if (settings.pdm?.buildEnabled) {
    setBatchScheduler(startPdmBatchScheduler(() => persistence.readJson('settings.json', {})));
    console.log('[pdm] nightly feature batch enabled (includes proactive CMMS check when pending failure)');
  } else {
    console.log('[pdm] top bar PdM button · Historian → PdM… · pending failure → CMMS WO when cmms.autoWorkOrdersFromPdm');
  }
  try {
    const { registry: cameraRegistry } = require('./src/cameras/cameraRegistry');
    const go2rtc = require('./src/cameras/go2rtcManager');
    const { stopCameraSystem } = require('./src/cameras/cameraSystemControl');
    const camSettings = cameraRegistry.settings();
    go2rtc.attachUpgradeProxy(httpServer, () => cameraRegistry.settings());
    if (camSettings.camerasEnabled === false) {
      await stopCameraSystem();
      console.log('[cameras] camera system disabled in settings (Cameras → Administration… → Settings)');
    } else if (camSettings.go2rtcEnabled !== false) {
      await go2rtc.start(camSettings);
      const sync = await go2rtc.syncAllFromRegistry(cameraRegistry, camSettings);
      const ok = sync.synced.filter((s) => s.ok).length;
      const skipped = sync.skipped?.length || 0;
      if (sync.synced.length || skipped) {
        const parts = [`synced ${ok}/${sync.synced.length}`];
        if (skipped) parts.push(`skipped ${skipped} unreachable`);
        console.log(`[go2rtc] ${parts.join(', ')} camera stream(s)`);
      }
    }
    const unprobed = camSettings.camerasEnabled === false
      ? []
      : cameraRegistry.listCameraRecords().filter((c) => !c.probeStatus && !c.rtspUrl);
    if (unprobed.length) {
      const { probeCamera } = require('./src/cameras/cameraProbe');
      console.log(`[cameras] auto-probing ${unprobed.length} unprobed camera(s)…`);
      for (const rec of unprobed) {
        try {
          const probe = await probeCamera(rec, { settings: camSettings, apiBase: '/api' });
          cameraRegistry.applyProbe(rec.cameraId, probe);
          if (probe.ok) {
            console.log(`[cameras] probe OK: ${rec.cameraId} (${rec.host})`);
          } else {
            console.warn(`[cameras] probe failed: ${rec.cameraId} — ${probe.error || 'unknown error'}`);
          }
        } catch (e) {
          console.warn(`[cameras] probe ${rec.cameraId}:`, e.message || e);
        }
      }
      if (camSettings.go2rtcEnabled !== false) {
        try {
          await go2rtc.syncAllFromRegistry(cameraRegistry, camSettings);
        } catch (e) {
          console.warn('[go2rtc] post-probe sync:', e.message || e);
        }
      }
    }
  } catch (e) {
    console.warn('[go2rtc] startup:', e.message || e);
  }
  try {
    const { isCloudDeployment } = require('./src/cloud/agentProtocol');
    const { attachAgentHub } = require('./src/cloud/agentHub');
    const siteAgent = require('./src/cloud/siteAgent');
    if (isCloudDeployment()) {
      attachAgentHub(httpServer);
      console.log('[cloud-sites] agent hub listening on /api/sites/:siteId/agent');
    }
    const agentCfg = siteAgent.loadConfig();
    if (agentCfg.enabled && agentCfg.cloudUrl && agentCfg.siteId) {
      await siteAgent.start();
      console.log(`[site-agent] starting → ${agentCfg.cloudUrl} site=${agentCfg.siteId}`);
    }
  } catch (e) {
    console.warn('[cloud-sites] startup:', e.message || e);
  }
  try {
    const { registry: cameraRegistry } = require('./src/cameras/cameraRegistry');
    const cameraScheduler = require('./src/cameras/cameraScheduler');
    const schedSettings = cameraRegistry.settings();
    if (schedSettings.camerasEnabled !== false && schedSettings.snapshotArchiveEnabled) {
      cameraScheduler.start();
    }
  } catch (e) {
    console.warn('[camera-scheduler] startup:', e.message || e);
  }
  try {
    const { registry: cameraRegistry } = require('./src/cameras/cameraRegistry');
    const cameraLiveSampler = require('./src/cameras/cameraLiveSampler');
    const cameraMotionMonitor = require('./src/cameras/cameraMotionMonitor');
    const camSettings = cameraRegistry.settings();
    if (camSettings.camerasEnabled !== false) {
      if (camSettings.cameraAiEnabled !== false) {
        if (camSettings.cameraAiLiveEnabled !== false) cameraLiveSampler.start();
        if (camSettings.cameraAiMotionEnabled !== false) cameraMotionMonitor.start();
        console.log('[camera-ai] vision pipeline started (live + motion + post-capture)');
      }
      const cameraTagBridge = require('./src/cameras/cameraTagBridge');
      if (camSettings.cameraTagBridgeEnabled !== false) {
        cameraTagBridge.start();
        console.log('[camera-tag-bridge] I/O overlay edge snapshots enabled');
      }
    } else {
      console.log('[cameras] vision pipeline skipped (camera system disabled)');
    }
  } catch (e) {
    console.warn('[camera-ai] startup:', e.message || e);
  }
  process.on('unhandledRejection', (err) => {
    console.error('[unhandledRejection]', err?.message || err);
  });
}

boot().catch((e) => {
  console.error(e);
  process.exit(1);
});

function removePidFile() {
  try {
    fs.unlinkSync(path.join(DATA_DIR, 'mooreview.pid'));
  } catch { /* ignore */ }
}

process.on('SIGINT', () => {
  try {
    const { flushDebouncedSave } = require('./src/parc/deviceRegistry');
    flushDebouncedSave();
  } catch { /* ignore */ }
  removePidFile();
  process.exit(0);
});
process.on('SIGTERM', () => {
  try {
    const { flushDebouncedSave } = require('./src/parc/deviceRegistry');
    flushDebouncedSave();
  } catch { /* ignore */ }
  removePidFile();
  process.exit(0);
});
process.on('exit', removePidFile);

module.exports = { app, tagStore, driverManager, scanEngine, graphHistory };
