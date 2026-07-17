'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const { DEFAULT_PORT, DATA_DIR, ST_DIR } = require('./src/config');
const { ensureUserImportsDir } = require('./src/hmi/hmiUserAssets');
const persistence = require('./src/persistence');
const { TagStore } = require('./src/tags/tagStore');
const { DriverManager } = require('./src/drivers');
const { ScanEngine, shouldAutoStartRuntime } = require('./src/runtime/scanEngine');
const { GraphHistory } = require('./src/runtime/graphHistory');
const { createExpressApi } = require('./src/api/expressRouter');
const { setTagStore } = require('./src/cameras/cameraAiHolder');
const { createPageRoutes } = require('./src/routes/pages');
const { createHmiAssetRedirect } = require('./src/routes/staticAssets');
const programStore = require('./src/programs/programStore');
const mongoTagLogger = require('./src/logger/mongoTagLogger');
const { registry } = require('./src/parc/deviceRegistry');
const { getMqttCentralHub } = require('./src/parc/mqttCentralHub');
const { startPdmBatchScheduler } = require('./src/pdm/pdmBatchScheduler');
const { setBatchScheduler } = require('./src/api/routes/pdmSchedulerHolder');

const PRODUCT = process.env.MOOREVIEW_PRODUCT || 'mvp-suite';

const tagStore = new TagStore();
const driverManager = new DriverManager(tagStore);
const graphHistory = new GraphHistory();
const scanEngine = new ScanEngine(tagStore, driverManager, graphHistory);

const { version: APP_VERSION } = require('./package.json');
const publicRoot = path.join(__dirname, 'public');

const app = express();
app.use(express.json({ limit: '12mb' }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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
  const { attachSession, requireAuth } = require('./src/tenants/authMiddleware');
  app.use(attachSession);

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
    res.render('cloud-login', { assetV: APP_VERSION, appVersion: APP_VERSION });
  });

  app.use((req, res, next) => {
    if (req.path === '/login' || req.path === '/health') return next();
    if (req.path.startsWith('/api/')) return next();
    if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|map)$/i.test(req.path)) return next();
    if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/hmi/')) return next();
    return requireAuth(req, res, next);
  });
}

app.use(createHmiAssetRedirect(publicRoot));
ensureUserImportsDir(DATA_DIR);
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

if (DEPLOYMENT !== 'cloud') {
  app.get('/health', (req, res) => {
    res.json({
      ok: true,
      app: 'MooreVIEW',
      product: PRODUCT,
      version: APP_VERSION,
      deployment: 'appliance',
      role: 'appliance',
      studio: true,
      tenantId: 'local',
      runtime: scanEngine.status(),
      dataDir: DATA_DIR,
      stDir: ST_DIR,
    });
  });
}

async function boot() {
  console.log('[boot] MooreVIEW starting…');
  persistence.ensureDataDir();
  programStore.migrateLegacyProgram();
  const settings = persistence.readJson('settings.json', {});
  const cloudDefault = resolveDeployment() === 'cloud' ? 3100 : DEFAULT_PORT;
  const port = process.env.PORT || process.env.MOOREVIEW_PORT || settings.port || cloudDefault;
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
  const label = resolveDeployment() === 'cloud' ? 'Cloud Studio' : 'MVP Suite';
  console.log(`MooreVIEW ${label}  http://127.0.0.1:${port}`);
  console.log(`Data: ${DATA_DIR}`);
  console.log(`ST programs: ${ST_DIR}`);

  if (settings.mongoLogger?.uri) {
    try {
      await mongoTagLogger.setConfig(settings.mongoLogger);
    } catch (e) {
      console.warn('[mongo] startup connect:', e.message || e);
    }
  }
  try {
    await driverManager.rebuild();
  } catch (e) {
    console.warn('[drivers] rebuild at startup:', e.message || e);
  }
  if (shouldAutoStartRuntime(settings, driverManager.configs)) {
    try {
      await scanEngine.start();
      console.log('[boot] runtime started (driver polling + historian)');
    } catch (e) {
      console.warn('[boot] runtime auto-start:', e.message || e);
    }
  }
  if (settings.mqttParc?.enabled) {
    try {
      await getMqttCentralHub(registry).start(settings.mqttParc);
      console.log('[mqtt-parc] central hub connected');
    } catch (e) {
      console.warn('[mqtt-parc] hub start:', e.message || e);
    }
  }
  if (settings.pdm?.buildEnabled) {
    setBatchScheduler(startPdmBatchScheduler(() => persistence.readJson('settings.json', {})));
    console.log('[pdm] nightly feature batch enabled');
  }
  try {
    const { registry: cameraRegistry } = require('./src/cameras/cameraRegistry');
    const go2rtc = require('./src/cameras/go2rtcManager');
    const camSettings = cameraRegistry.settings();
    go2rtc.attachUpgradeProxy(httpServer, () => cameraRegistry.settings());
    if (camSettings.go2rtcEnabled !== false) {
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
    if (cameraRegistry.settings().snapshotArchiveEnabled) {
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
  removePidFile();
  process.exit(0);
});
process.on('SIGTERM', () => {
  removePidFile();
  process.exit(0);
});
process.on('exit', removePidFile);

module.exports = { app, tagStore, driverManager, scanEngine, graphHistory };
