'use strict';

const config = require('./config');
const { createReceiver, closeClient, isConfigured } = require('./serviceBusClient');
const { publish, connectMqtt, closeMqtt, isConnected } = require('./mqttPublisher');
const { mapServiceBusToMqtt } = require('./mapMessage');

/** @type {import('@azure/service-bus').ServiceBusReceiver | null} */
let receiver = null;

const stats = {
  received: 0,
  published: 0,
  errors: 0,
  skipped: 0,
  startedAt: Date.now(),
};

function snapshotStats() {
  const uptimeSec = Math.round((Date.now() - stats.startedAt) / 1000);
  return { ...stats, uptimeSec, mqttConnected: isConnected() };
}

async function handleMessage(message) {
  stats.received += 1;
  try {
    const { topic, payload, serial } = mapServiceBusToMqtt(message, {
      eventsTopicTemplate: config.MQTT_EVENTS_TOPIC_TEMPLATE,
    });
    await publish(topic, payload);
    stats.published += 1;
    if (stats.published % config.LOG_EVERY_N === 0) {
      console.log(`[bridge] published ${stats.published} messages (last serial=${serial})`);
    }
  } catch (err) {
    stats.errors += 1;
    console.error('[bridge] message failed:', err.message || err);
    throw err;
  }
}

async function startBridge() {
  if (!isConfigured()) {
    throw new Error('Service Bus not configured');
  }

  await connectMqtt();
  console.log(`[bridge] MQTT connected → ${config.MQTT_BROKER_URL}`);

  receiver = createReceiver();
  const source = config.SERVICE_BUS_TOPIC
    ? `topic ${config.SERVICE_BUS_TOPIC}/${config.SERVICE_BUS_SUBSCRIPTION}`
    : `queue ${config.SERVICE_BUS_QUEUE}`;
  console.log(`[bridge] Service Bus listening on ${source}`);

  receiver.subscribe(
    {
      processMessage: async (message) => {
        try {
          await handleMessage(message);
          await receiver.completeMessage(message);
        } catch {
          await receiver.abandonMessage(message);
        }
      },
      processError: async (args) => {
        console.error('[bridge] Service Bus receive error:', args.error?.message || args.error);
      },
    },
    {
      maxConcurrentCalls: config.MAX_CONCURRENT,
      autoCompleteMessages: false,
    },
  );

  const healthTimer = setInterval(() => {
    console.log('[bridge] health', JSON.stringify(snapshotStats()));
  }, config.HEALTH_LOG_INTERVAL_MS);
  healthTimer.unref();

  return { stats: snapshotStats, healthTimer };
}

async function stopBridge(healthTimer) {
  if (healthTimer) clearInterval(healthTimer);
  if (receiver) {
    await receiver.close();
    receiver = null;
  }
  await closeMqtt();
  await closeClient();
  console.log('[bridge] stopped', JSON.stringify(snapshotStats()));
}

module.exports = {
  startBridge,
  stopBridge,
  snapshotStats,
  handleMessage,
};
