'use strict';

const { app } = require('@azure/functions');
const { mapServiceBusToMqtt } = require('../lib/mapMessage');
const { publishOnce } = require('../lib/mqttPublish');

/**
 * Azure serverless: nexcomm-telemetry → mqtts://mqtt.mooreview.io
 *
 * Serial `xxxx-xxxxxx` (and hex DSN / IMEI) → topic
 *   /devices/<normalized-serial>/messages/events/
 *
 * Device templates: apply lift_station_epi with serialNum = normalized (no hyphens)
 * and brokerUrl = mqtts://mqtt.mooreview.io:8883 (+ MOSQUITTO user/pass).
 */
app.serviceBusQueue('nexcommTelemetryToMqtt', {
  connection: 'ServiceBusConnection',
  queueName: '%SERVICE_BUS_QUEUE%',
  handler: async (message, context) => {
    const template = process.env.MQTT_EVENTS_TOPIC_TEMPLATE
      || '/devices/{serial}/messages/events/';

    const meta = context.triggerMetadata || {};
    const props = meta.userProperties
      || meta.applicationProperties
      || meta.ApplicationProperties
      || {};

    const envelope = (message && typeof message === 'object'
      && Object.prototype.hasOwnProperty.call(message, 'body'))
      ? message
      : {
        body: message,
        applicationProperties: props,
        userProperties: props,
        subject: meta.subject || meta.Subject,
      };

    const mapped = mapServiceBusToMqtt(envelope, { eventsTopicTemplate: template });
    await publishOnce(mapped.topic, mapped.payload);
    context.log(`published serial=${mapped.serial} topic=${mapped.topic}`);
  },
});
