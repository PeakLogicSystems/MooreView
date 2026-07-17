'use strict';

if (!process.env.MOOREVIEW_DEPLOYMENT) {
  process.env.MOOREVIEW_DEPLOYMENT = 'cloud';
}

const { createCloudApp } = require('./api/cloudApp');
const configStore = require('./configStore');
const { connectMongo, closeMongo } = require('./db/mongo');
const { ensureIndexes } = require('./db/indexes');
const { PORT } = require('./config');
const { registerCloudServices } = require('./messaging/cloudServices');
const { startServiceBusWorkers, stopServiceBusWorkers } = require('./messaging/workers');
const { closeEventHub } = require('./messaging/eventHub');
const { startCloudMqttIngest, stopCloudMqttIngest } = require('./ingest/mqttCloudIngest');
const { DEFAULT_MQTT_PARC_BROKER } = require('./config');
const { startConnectivityRenewalScheduler } = require('./connectivity/connectivityRenewalScheduler');
const { setRenewalScheduler } = require('./api/connectivityRenewalHolder');

async function main() {
  await connectMongo();
  await ensureIndexes();
  await configStore.init();

  registerCloudServices();
  await startServiceBusWorkers();

  if (process.env.CLOUD_MQTT_INGEST !== 'false') {
    startCloudMqttIngest();
    console.log(`[cloud-mqtt-ingest] enabled → ${DEFAULT_MQTT_PARC_BROKER} (set CLOUD_MQTT_INGEST=false to disable)`);
  }

  const renewalScheduler = startConnectivityRenewalScheduler();
  setRenewalScheduler(renewalScheduler);
  console.log('[connectivity-billing] renewal scheduler started');

  const app = createCloudApp();
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`MooreVIEW Cloud API listening on :${PORT}`);
  });

  try {
    const { isCloudDeployment } = require('./cloud/agentProtocol');
    const { attachAgentHub } = require('./cloud/agentHub');
    if (isCloudDeployment()) {
      attachAgentHub(server);
      console.log('[cloud-sites] agent hub listening on /api/sites/:siteId/agent');
    }
  } catch (e) {
    console.warn('[cloud-sites] agent hub:', e.message || e);
  }

  const shutdown = async (signal) => {
    console.log(`[cloud] ${signal} — shutting down`);
    server.close();
    renewalScheduler.stop();
    await stopCloudMqttIngest().catch(() => {});
    await configStore.shutdown().catch(() => {});
    await stopServiceBusWorkers();
    await closeEventHub();
    await closeMongo();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[cloud] boot failed:', err.message);
    process.exit(1);
  });
}

module.exports = { main };
