@description('Nexcomm SB → mqtt.mooreview.io Azure Function (build #1)')
param location string = resourceGroup().location
param namePrefix string = 'mv-nexcomm'
param serviceBusNamespaceName string
param queueName string = 'nexcomm-telemetry'
param createQueue bool = true
@secure()
param serviceBusConnectionString string
@secure()
param mqttPassword string
param mqttBrokerUrl string = 'mqtts://mqtt.mooreview.io:8883'
param mqttUsername string = 'mooreview'
param mqttClientId string = 'nexcomm-sb-fn'
param functionAppName string = ''
param storageAccountName string = ''
param appServicePlanName string = ''
param applicationInsightsName string = ''

var fnName = empty(functionAppName) ? take('${namePrefix}-sb-mqtt-${uniqueString(resourceGroup().id)}', 60) : functionAppName
var stName = empty(storageAccountName) ? take(replace('${namePrefix}fn${uniqueString(resourceGroup().id)}', '-', ''), 24) : storageAccountName
var planName = empty(appServicePlanName) ? '${namePrefix}-sb-mqtt-plan' : appServicePlanName
var aiName = empty(applicationInsightsName) ? '${namePrefix}-sb-mqtt-ai' : applicationInsightsName

resource sbNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' existing = {
  name: serviceBusNamespaceName
}

resource telemetryQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = if (createQueue) {
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

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: stName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: aiName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Request_Source: 'rest'
  }
}

// Consumption (Y1) — serverless
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: false
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: fnName
  location: location
  kind: 'functionapp'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      netFrameworkVersion: 'v8.0'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: take(toLower(fnName), 63)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'ServiceBusConnection'
          value: serviceBusConnectionString
        }
        {
          name: 'SERVICE_BUS_QUEUE'
          value: queueName
        }
        {
          name: 'MQTT_BROKER_URL'
          value: mqttBrokerUrl
        }
        {
          name: 'MQTT_USERNAME'
          value: mqttUsername
        }
        {
          name: 'MQTT_PASSWORD'
          value: mqttPassword
        }
        {
          name: 'MQTT_CLIENT_ID'
          value: mqttClientId
        }
        {
          name: 'MQTT_QOS'
          value: '1'
        }
        {
          name: 'MQTT_EVENTS_TOPIC_TEMPLATE'
          value: '/devices/{serial}/messages/events/'
        }
      ]
    }
  }
  dependsOn: [
    telemetryQueue
  ]
}

output functionAppName string = functionApp.name
output functionAppHostname string = functionApp.properties.defaultHostName
output storageAccountName string = storage.name
output queueName string = queueName
output deployHint string = 'Publish zip from pack-nexcomm-sb-mqtt-function.ps1 via: az functionapp deployment source config-zip -g <rg> -n ${fnName} --src <zip>'
