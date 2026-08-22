'use strict';

const config = require('./config');

let client = null;

function isConfigured() {
  return Boolean(config.SERVICE_BUS_CONNECTION_STRING || config.SERVICE_BUS_NAMESPACE);
}

function getClient() {
  if (client) return client;
  if (!isConfigured()) {
    throw new Error('Set SERVICE_BUS_CONNECTION_STRING or SERVICE_BUS_NAMESPACE');
  }

  const { ServiceBusClient } = require('@azure/service-bus');

  if (config.SERVICE_BUS_CONNECTION_STRING) {
    client = new ServiceBusClient(config.SERVICE_BUS_CONNECTION_STRING);
    return client;
  }

  const { DefaultAzureCredential } = require('@azure/identity');
  const fqns = `${config.SERVICE_BUS_NAMESPACE}.servicebus.windows.net`;
  client = new ServiceBusClient(fqns, new DefaultAzureCredential());
  return client;
}

function createReceiver() {
  const sb = getClient();
  if (config.SERVICE_BUS_TOPIC && config.SERVICE_BUS_SUBSCRIPTION) {
    return sb.createReceiver(config.SERVICE_BUS_TOPIC, config.SERVICE_BUS_SUBSCRIPTION);
  }
  if (config.SERVICE_BUS_TOPIC) {
    throw new Error('SERVICE_BUS_SUBSCRIPTION required when SERVICE_BUS_TOPIC is set');
  }
  return sb.createReceiver(config.SERVICE_BUS_QUEUE);
}

async function closeClient() {
  if (client) {
    await client.close();
    client = null;
  }
}

module.exports = {
  isConfigured,
  getClient,
  createReceiver,
  closeClient,
};
