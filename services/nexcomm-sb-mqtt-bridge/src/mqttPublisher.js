'use strict';

const mqtt = require('mqtt');
const config = require('./config');

/** @type {import('mqtt').MqttClient | null} */
let client = null;
/** @type {Promise<void> | null} */
let connectPromise = null;

function mqttOptions() {
  const opts = {
    clientId: config.MQTT_CLIENT_ID,
    keepalive: 60,
    reconnectPeriod: 5000,
    clean: true,
  };
  if (config.MQTT_USERNAME) {
    opts.username = config.MQTT_USERNAME;
    opts.password = config.MQTT_PASSWORD || '';
  }
  return opts;
}

function connectMqtt() {
  if (client?.connected) return Promise.resolve(client);
  if (connectPromise) return connectPromise;

  connectPromise = new Promise((resolve, reject) => {
    client = mqtt.connect(config.MQTT_BROKER_URL, mqttOptions());

    const onConnect = () => {
      cleanup();
      connectPromise = null;
      resolve(client);
    };
    const onError = (err) => {
      cleanup();
      connectPromise = null;
      reject(err);
    };
    const cleanup = () => {
      client?.off('connect', onConnect);
      client?.off('error', onError);
    };

    client.once('connect', onConnect);
    client.once('error', onError);
  });

  return connectPromise;
}

async function publish(topic, payload) {
  const c = await connectMqtt();
  return new Promise((resolve, reject) => {
    c.publish(
      topic,
      payload,
      { qos: config.MQTT_QOS, retain: config.MQTT_RETAIN },
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

async function closeMqtt() {
  connectPromise = null;
  if (client) {
    await new Promise((resolve) => {
      client.end(false, {}, resolve);
    });
    client = null;
  }
}

function isConnected() {
  return Boolean(client?.connected);
}

module.exports = {
  connectMqtt,
  publish,
  closeMqtt,
  isConnected,
};
