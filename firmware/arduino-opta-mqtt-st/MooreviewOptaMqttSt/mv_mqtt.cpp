#include "mv_mqtt.h"
#include "mv_version.h"
#include "mv_config.h"
#include "mv_st.h"
#include "mv_tags.h"
#include "mv_expansions.h"
#include "mv_debug.h"
#include <Ethernet.h>
#include <PubSubClient.h>
#include <string.h>

extern bool g_runtimeRunning;
extern uint32_t g_scanMs;
extern uint32_t g_lastScanMs;

static EthernetClient s_eth;
static PubSubClient s_mqtt(s_eth);
static MvMqttConfig s_cfg;
static bool s_pauseTelemetry = false;
static unsigned long s_lastReport = 0;
static bool s_forceTelemetry = false;

static void appendExpansionModules(JsonObject doc) {
  doc["expansionBlueprint"] = mvExpBlueprintEnabled();
  doc["expansionCount"] = mvExpDetectedCount();
  JsonArray det = doc.createNestedArray("expansionModules");
  for (uint8_t i = 0; i < mvExpDetectedCount(); i++) {
    MvExpDetected d;
    if (!mvExpGetDetected(i, &d)) continue;
    JsonObject o = det.createNestedObject();
    o["slot"] = d.slot;
    o["type"] = d.type;
    o["label"] = d.label;
    o["present"] = d.present;
  }
}

static String tTelemetry() { return String(s_cfg.topicPrefix) + "/" + s_cfg.deviceId + "/telemetry"; }
static String tOnline() { return String(s_cfg.topicPrefix) + "/" + s_cfg.deviceId + "/online"; }
static String tCmd() { return String(s_cfg.topicPrefix) + "/" + s_cfg.deviceId + "/cmd"; }
static String tCmdRes() { return String(s_cfg.topicPrefix) + "/" + s_cfg.deviceId + "/cmd/response"; }
static String tConfig() { return String(s_cfg.topicPrefix) + "/" + s_cfg.deviceId + "/config"; }

static void mqttCallback(char* topic, byte* payload, unsigned int len) {
  String msg;
  for (unsigned int i = 0; i < len; i++) msg += (char)payload[i];
  String t(topic);

  if (t == tConfig()) {
    StaticJsonDocument<256> doc;
    if (!deserializeJson(doc, msg)) {
      if (doc.containsKey("pauseTelemetry")) s_pauseTelemetry = doc["pauseTelemetry"].as<bool>();
      if (doc.containsKey("reportMs")) {
        uint32_t ms = doc["reportMs"].as<uint32_t>();
        if (ms >= 100 && ms <= 600000) s_cfg.reportMs = ms;
      }
    }
    return;
  }

  if (t != tCmd()) return;
  String response;
  if (mvMqttHandleCommand(msg.c_str(), response) && response.length()) {
    s_mqtt.publish(tCmdRes().c_str(), response.c_str(), false);
  }
}


void mvMqttBegin(const MvMqttConfig* cfg) {
  if (!cfg) return;
  s_cfg = *cfg;
  s_mqtt.setServer(s_cfg.broker, s_cfg.port);
  s_mqtt.setCallback(mqttCallback);
  s_mqtt.setBufferSize(MV_BC_MAX + 4096);
}

void mvMqttLoop() {
  if (!s_mqtt.connected()) {
    String cid = String("mv-opta-st-") + s_cfg.deviceId;
    if (s_mqtt.connect(cid.c_str(), tOnline().c_str(), 1, true, "{\"online\":false}")) {
      s_mqtt.subscribe(tCmd().c_str(), 1);
      s_mqtt.subscribe(tConfig().c_str(), 1);
      s_mqtt.publish(tOnline().c_str(), "{\"online\":true}", true);
      MV_LOG2("MQTT connected broker ", s_cfg.broker);
    }
  }
  s_mqtt.loop();
}

bool mvMqttConnected() { return s_mqtt.connected(); }

void mvMqttSetPauseTelemetry(bool pause) { s_pauseTelemetry = pause; }

bool mvMqttHandleCommand(const char* json, String& responseOut) {
  StaticJsonDocument<384> peek;
  if (deserializeJson(peek, json)) return false;
  const char* id = peek["id"] | "";
  const char* op = peek["op"] | "";
  if (!id[0] || !op[0]) return false;
  MV_LOG2("MQTT cmd ", op);

  StaticJsonDocument<768> res;
  res["id"] = id;
  bool ok = true;
  const char* errMsg = nullptr;

  DynamicJsonDocument reqDoc(MV_BC_MAX + 4096);
  JsonDocument* req = &peek;
  if (strcmp(op, "put_program") == 0) {
    if (deserializeJson(reqDoc, json)) {
      ok = false;
      errMsg = "put_program json too large";
      res["ok"] = ok;
      res["error"] = errMsg;
      serializeJson(res, responseOut);
      return true;
    }
    req = &reqDoc;
  }

  if (strcmp(op, "put_program") == 0) {
    JsonObject body = (*req)["body"].as<JsonObject>();
    if (body.isNull()) {
      ok = false;
      errMsg = "missing body";
    } else {
      char protoErr[96];
      const int clientProto = body["protocolVersion"] | 0;
      const char* clientVer = body["clientVersion"] | "";
      if (!mvCheckClientProtocol(clientProto, clientVer, protoErr, sizeof(protoErr))) {
        ok = false;
        errMsg = protoErr;
      } else if (!mvProgramLoad(body)) {
        ok = false;
        errMsg = mvLastProgramError();
      } else {
        MV_LOG2("put_program OK tags=", mvTagCount());
        JsonObject out = res.createNestedObject("body");
        out["ok"] = true;
        out["programOk"] = true;
        out["tagCount"] = mvTagCount();
      }
    }
  } else if (strcmp(op, "get_program") == 0) {
    JsonObject out = res.createNestedObject("body");
    out["programLoaded"] = mvProgramValid();
    out["error"] = mvLastProgramError();
  } else if (strcmp(op, "scan_expansions") == 0) {
    mvExpRescan();
    mvExpEnsureTags();
    s_forceTelemetry = true;
    JsonObject out = res.createNestedObject("body");
    appendExpansionModules(out);
    out["tagCount"] = mvTagCount();
    MV_LOG2("scan_expansions modules=", mvExpDetectedCount());
  } else if (strcmp(op, "runtime_start") == 0) {
    g_scanMs = (*req)["body"]["scanMs"] | MV_SCAN_MS_DEFAULT;
    mvOneShotReset();
    g_runtimeRunning = true;
    g_lastScanMs = millis();
    MV_LOG2("runtime_start scanMs=", g_scanMs);
    JsonObject out = res.createNestedObject("body");
    out["running"] = true;
    out["scanMs"] = g_scanMs;
  } else if (strcmp(op, "runtime_stop") == 0) {
    g_runtimeRunning = false;
    JsonObject out = res.createNestedObject("body");
    out["running"] = false;
  } else if (strcmp(op, "runtime_status") == 0) {
    JsonObject out = res.createNestedObject("body");
    out["running"] = g_runtimeRunning;
    out["scanMs"] = g_scanMs;
    out["programOk"] = mvProgramValid();
    out["programError"] = mvLastProgramError();
  } else {
    ok = false;
    errMsg = "unknown op";
  }

  res["ok"] = ok;
  if (errMsg) res["error"] = errMsg;
  serializeJson(res, responseOut);
  return true;
}

void mvMqttMaybePublishTelemetry(bool runtimeRunning, uint32_t scanMs, uint32_t cycles, uint32_t lastCycleUs) {
  if (!s_mqtt.connected() || s_pauseTelemetry) return;
  unsigned long now = millis();
  if (!s_forceTelemetry && now - s_lastReport < s_cfg.reportMs) return;
  s_lastReport = now;
  s_forceTelemetry = false;

  StaticJsonDocument<8192> doc;
  doc["deviceId"] = s_cfg.deviceId;
  doc["name"] = "Arduino Opta ST";
  doc["platform"] = "arduino-opta-mqtt-st";
  doc["reportIntervalSec"] = (int)(s_cfg.reportMs / 1000);

  JsonObject rt = doc.createNestedObject("runtime");
  rt["running"] = runtimeRunning;
  rt["scanMs"] = scanMs;
  rt["cycles"] = cycles;
  rt["lastCycleUs"] = lastCycleUs;
  rt["programOk"] = mvProgramValid();

  appendExpansionModules(doc.as<JsonObject>());

  JsonArray tags = doc.createNestedArray("tags");
  mvTagsToParcJson(tags);

  String out;
  serializeJson(doc, out);
  s_mqtt.publish(tTelemetry().c_str(), out.c_str(), false);
}
