/*
 * MooreVIEW Opta — ST runtime + MQTT Parc (mooreview/v1)
 * ST modules shared with arduino-opta-st; programs deployed via MQTT cmd.
 */
#include <Arduino.h>
#include "mv_config.h"
#include "mv_eth.h"
#include <ArduinoJson.h>
#include "mv_store.h"
#include "mv_setup_web.h"
#include "mv_http.h"
#include "mv_wifi.h"
#include "mv_expansions.h"
#include "mv_io.h"
#include "mv_tags.h"
#include "mv_st.h"
#include "mv_mqtt.h"
#include "mv_ota.h"
#include "mv_debug.h"
#include "mv_version.h"
#include "mv_device_status.h"

static byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };
static MvDeviceConfig g_cfg;
bool g_runtimeRunning = false;
uint32_t g_scanMs = MV_SCAN_MS_DEFAULT;
uint32_t g_lastScanMs = 0;
uint32_t g_cycles = 0;
uint32_t g_lastCycleUs = 0;

static MvMqttConfig g_mqttCfg = {
  "192.168.1.233",
  1883,
  "opta_st_01",
  "mooreview/v1",
  180000,
};

static void sendJson(Stream& client, int code, const JsonDocument& doc) {
  String out;
  serializeJson(doc, out);
  mvHttpSendResponse(client, code, "application/json", out);
}

static void sendJsonCStr(Stream& client, int code, const char* json) {
  mvHttpSendResponseCStr(client, code, "application/json", json);
}

static void handleStatus(Stream& client, const String& method, const String& path,
                         const String& body, const String& headerBlock) {
  (void)method;
  (void)path;
  (void)body;
  (void)headerBlock;
  StaticJsonDocument<1024> doc;
  mvFillDeviceStatus(doc.to<JsonObject>());
  sendJson(client, 200, doc);
}

static void handleTags(Stream& client, const String& method, const String& path,
                       const String& body, const String& headerBlock) {
  (void)method;
  (void)path;
  (void)body;
  (void)headerBlock;
  StaticJsonDocument<8192> doc;
  JsonObject tags = doc.createNestedObject("tags");
  mvTagsToJson(tags);
  doc["ok"] = true;
  sendJson(client, 200, doc);
}

static void handleProgramPut(Stream& client, const String& method, const String& path,
                             const String& body, const String& headerBlock) {
  (void)method;
  (void)path;
  (void)headerBlock;
  if (body.length() == 0) {
    sendJsonCStr(client, 400, "{\"error\":\"missing body\"}");
    return;
  }
  DynamicJsonDocument doc(MV_PROGRAM_JSON_MAX);
  if (deserializeJson(doc, body)) {
    sendJsonCStr(client, 400, "{\"error\":\"invalid json\"}");
    return;
  }
  if (!mvProgramLoad(doc.as<JsonObject>())) {
    StaticJsonDocument<256> err;
    err["ok"] = false;
    err["error"] = mvLastProgramError();
    sendJson(client, 400, err);
    return;
  }
  sendJsonCStr(client, 200, "{\"ok\":true}");
}

static void runOneScan(uint32_t dtMs) {
  unsigned long t0 = micros();
  mvExecuteScan(dtMs);
  g_lastCycleUs = micros() - t0;
  g_cycles++;
}

static void handleRuntimeStart(Stream& client, const String& method, const String& path,
                               const String& body, const String& headerBlock) {
  (void)method;
  (void)path;
  (void)body;
  (void)headerBlock;
  mvOneShotReset();
  g_runtimeRunning = true;
  g_lastScanMs = millis();
  MV_LOG("HTTP POST /api/runtime/start");
  sendJsonCStr(client, 200, "{\"ok\":true,\"running\":true}");
}

static void handleRuntimeStop(Stream& client, const String& method, const String& path,
                              const String& body, const String& headerBlock) {
  (void)method;
  (void)path;
  (void)body;
  (void)headerBlock;
  g_runtimeRunning = false;
  MV_LOG("HTTP POST /api/runtime/stop");
  sendJsonCStr(client, 200, "{\"ok\":true,\"running\":false}");
}

static void registerApiRoutes() {
#if (defined(ARDUINO_PORTENTA_H7_M7) || defined(ARDUINO_OPTA)) && MV_HAS_WEBSERVER
  mvHttpAddRoute("GET", "/api/status", handleStatus);
  mvHttpAddRoute("GET", "/api/tags", handleTags);
  mvHttpAddRoute("PUT", "/api/program", handleProgramPut);
  mvHttpAddRoute("POST", "/api/runtime/start", handleRuntimeStart);
  mvHttpAddRoute("POST", "/api/runtime/stop", handleRuntimeStop);
#endif
}

void setup() {
  Serial.begin(115200);
  delay(1500);
  MV_LOG("MooreVIEW Opta ST+MQTT boot (Serial 115200)");

  mvStoreLoad(&g_cfg);
  mvIoBegin();
  mvTagsBegin();
  MV_LOG2("tags at boot=", mvTagCount());
  mvExpBegin();
  mvExpApplyConfig(&g_cfg);
  mvExpEnsureTags();
  MV_LOG2("expansion modules=", mvExpDetectedCount());

  mvEthBegin(&g_cfg, mac);
  mvWifiBegin(&g_cfg);
  mvMqttBegin(&g_mqttCfg);
  mvOtaSetRuntimeFlag(&g_runtimeRunning);
  mvOtaBegin();

#if (defined(ARDUINO_PORTENTA_H7_M7) || defined(ARDUINO_OPTA)) && MV_HAS_WEBSERVER
  mvSetupRegisterRoutes();
  registerApiRoutes();
  mvOtaRegisterHttpRoutes();
  mvHttpBegin(MV_HTTP_PORT);
  MV_LOG2("Ethernet http://", Ethernet.localIP().toString());
#else
  MV_LOG("HTTP disabled on this board");
#endif

  if (mvWifiApActive()) {
    MV_LOG2("Setup WiFi AP http://", mvWifiApIp().toString() + ":" + String(MV_WIFI_HTTP_PORT));
  }
  MV_LOG("ready — MQTT Parc + local /setup status page");
}

void loop() {
#if (defined(ARDUINO_PORTENTA_H7_M7) || defined(ARDUINO_OPTA)) && MV_HAS_WEBSERVER
  Ethernet.maintain();
  mvHttpHandleClients();
#endif
  mvWifiHandleClients();
  mvMqttLoop();
  mvOtaLoop();

  if (g_runtimeRunning) {
    unsigned long now = millis();
    if (now - g_lastScanMs >= g_scanMs) {
      runOneScan(now - g_lastScanMs);
      g_lastScanMs = now;
    }
  }

  mvMqttMaybePublishTelemetry(g_runtimeRunning, g_scanMs, g_cycles, g_lastCycleUs);
}
