@description('Nexcomm telemetry queue for mooreVIEW Service Bus → MQTT bridge')
param location string = resourceGroup().location
param queueName string = 'nexcomm-telemetry'
param namespaceName string

resource sbNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' existing = {
  name: namespaceName
}

resource telemetryQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: sbNamespace
  name: queueName
  properties: {
    maxSizeInMegabytes: 1024
    defaultMessageTimeToLive: 'P7D'
    deadLetteringOnMessageExpiration: true
    maxDeliveryCount: 10
    enablePartitioning: false
  }
}

output queueName string = telemetryQueue.name
output queueResourceId string = telemetryQueue.id
