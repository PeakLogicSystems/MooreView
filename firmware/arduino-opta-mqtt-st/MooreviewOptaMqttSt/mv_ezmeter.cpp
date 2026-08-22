#include "mv_ezmeter.h"
#include "mv_debug.h"

#if MV_FIELDBUS && MV_EZMETER

#include <Arduino.h>
#include <string.h>
#include <ArduinoRS485.h>
#include <ArduinoModbus.h>
#include "mv_tags.h"
#include "mv_mqtt.h"
#include <math.h>

#define MV_EZ_NV_MAGIC 0x4D564557u
#define MV_EZ_NV_VERSION 1
#define MV_EZ_DEFAULT_NOM_V 120.0f
#define MV_EZ_DEFAULT_UV_V 108.0f

#pragma pack(push, 1)
struct MvEzMeterNv {
  uint32_t magic;
  uint16_t version;
  uint16_t nominalDeci;
  uint16_t undervoltDeci;
  uint16_t crc;
};
#pragma pack(pop)

#if defined(ARDUINO_OPTA) && __has_include(<kvstore_global_api.h>)
#include <kvstore_global_api.h>
#define MV_EZ_HAS_KV 1
static const char* MV_EZ_KV_KEY = "/kv/mv_ezmeter";
#endif

static MvEzMeterNv g_ezNv;
static bool g_ezNvLoaded = false;

static uint16_t mvEzNvCrc(const MvEzMeterNv* cfg) {
  const uint8_t* p = (const uint8_t*)cfg;
  uint16_t crc = 0xFFFF;
  const size_t n = sizeof(MvEzMeterNv) - sizeof(cfg->crc);
  for (size_t i = 0; i < n; i++) {
    crc ^= p[i];
    for (uint8_t b = 0; b < 8; b++) {
      crc = (crc & 1) ? (uint16_t)((crc >> 1) ^ 0xA001) : (uint16_t)(crc >> 1);
    }
  }
  return crc;
}

static bool mvEzNvValid(const MvEzMeterNv* cfg) {
  if (!cfg || cfg->magic != MV_EZ_NV_MAGIC || cfg->version != MV_EZ_NV_VERSION) return false;
  return cfg->crc == mvEzNvCrc(cfg);
}

static void mvEzNvDefaults(MvEzMeterNv* cfg) {
  memset(cfg, 0, sizeof(MvEzMeterNv));
  cfg->magic = MV_EZ_NV_MAGIC;
  cfg->version = MV_EZ_NV_VERSION;
  cfg->nominalDeci = (uint16_t)(MV_EZ_DEFAULT_NOM_V * 10.0f + 0.5f);
  cfg->undervoltDeci = (uint16_t)(MV_EZ_DEFAULT_UV_V * 10.0f + 0.5f);
  cfg->crc = mvEzNvCrc(cfg);
}

static float mvEzDeciToVolts(uint16_t deci, float fallback) {
  return deci ? (deci * 0.1f) : fallback;
}

static bool mvEzNvLoad(MvEzMeterNv* cfg) {
  mvEzNvDefaults(cfg);
#ifdef MV_EZ_HAS_KV
  uint8_t buf[sizeof(MvEzMeterNv)];
  size_t actual = 0;
  if (kv_get(MV_EZ_KV_KEY, buf, sizeof(buf), &actual) == 0 && actual == sizeof(MvEzMeterNv)) {
    MvEzMeterNv* tmp = (MvEzMeterNv*)buf;
    if (mvEzNvValid(tmp)) {
      memcpy(cfg, tmp, sizeof(MvEzMeterNv));
      return true;
    }
  }
#endif
  return true;
}

static bool mvEzNvSave(const MvEzMeterNv* cfg) {
  if (!cfg) return false;
  MvEzMeterNv tmp;
  memcpy(&tmp, cfg, sizeof(tmp));
  tmp.magic = MV_EZ_NV_MAGIC;
  tmp.version = MV_EZ_NV_VERSION;
  tmp.crc = mvEzNvCrc(&tmp);
  memcpy(&g_ezNv, &tmp, sizeof(g_ezNv));
  g_ezNvLoaded = true;
#ifdef MV_EZ_HAS_KV
  const bool ok = kv_set(MV_EZ_KV_KEY, &tmp, sizeof(tmp), 0) == 0;
#else
  const bool ok = true;
#endif
  if (ok) mvMqttRequestTelemetryFlush();
  return ok;
}

static const MvEzMeterNv* mvEzNvActive() {
  if (!g_ezNvLoaded) mvEzNvLoad(&g_ezNv);
  return &g_ezNv;
}

float mvEzmeterNominalV() {
  return mvEzDeciToVolts(mvEzNvActive()->nominalDeci, MV_EZ_DEFAULT_NOM_V);
}

float mvEzmeterUndervoltV() {
  return mvEzDeciToVolts(mvEzNvActive()->undervoltDeci, MV_EZ_DEFAULT_UV_V);
}

bool mvEzmeterSetNominalV(float volts) {
  if (volts < 1.0f || volts > 1000.0f) return false;
  MvEzMeterNv cfg;
  memcpy(&cfg, mvEzNvActive(), sizeof(cfg));
  cfg.nominalDeci = (uint16_t)(volts * 10.0f + 0.5f);
  const bool ok = mvEzNvSave(&cfg);
  if (ok) mvEzmeterApplyPqConfig();
  return ok;
}

bool mvEzmeterSetUndervoltV(float volts) {
  if (volts < 1.0f || volts > 1000.0f) return false;
  MvEzMeterNv cfg;
  memcpy(&cfg, mvEzNvActive(), sizeof(cfg));
  cfg.undervoltDeci = (uint16_t)(volts * 10.0f + 0.5f);
  const bool ok = mvEzNvSave(&cfg);
  if (ok) mvEzmeterApplyPqConfig();
  return ok;
}

void mvEzmeterApplyPqConfig() {
  mvEnsureTag("MECH_PQ_CFG_NOM_V", MV_REAL);
  mvEnsureTag("MECH_PQ_CFG_UV_V", MV_REAL);
  mvSetReal("MECH_PQ_CFG_NOM_V", mvEzmeterNominalV());
  mvSetReal("MECH_PQ_CFG_UV_V", mvEzmeterUndervoltV());
}

static bool g_ready = false;
static bool g_lastPollOk = false;
static uint32_t g_lastLivePollMs = 0;
static uint32_t g_lastEnergyPollMs = 0;

static int16_t signExtend16(uint16_t raw) {
  return (raw & 0x8000) ? (int16_t)(raw - 0x10000) : (int16_t)raw;
}

static int32_t combineWords32(uint16_t hi, uint16_t lo, bool signed32) {
  uint32_t v = ((uint32_t)hi << 16) | lo;
  if (signed32 && (v & 0x80000000u)) v -= 0x100000000u;
  return (int32_t)v;
}

static float thdPctFromPf(float pf) {
  const float p = fabsf(pf);
  if (p < 0.05f) return 0.0f;
  const float inner = 1.0f / (p * p) - 1.0f;
  if (inner <= 0.0f) return 0.0f;
  const float thd = sqrtf(inner) * 100.0f;
  return thd > 100.0f ? 100.0f : thd;
}

static void ensureEzmeterTags() {
  static bool done = false;
  if (done) return;
  done = true;
  const char* live[] = {
    "DDS_V_A", "DDS_I_A", "DDS_W_A", "DDS_HZ_A", "DDS_PF_A",
    "DDS_V_B", "DDS_I_B", "DDS_W_B", "DDS_HZ_B", "DDS_PF_B",
    "DDS_V_C", "DDS_I_C", "DDS_W_C", "DDS_HZ_C", "DDS_PF_C",
    "DDS_VA_A", "DDS_VA_B", "DDS_VA_C",
    "DDS_WH_SUM_IMP", "DDS_WH_SUM_EXP",
    "MECH_METER_KWH", "MECH_METER_KWH_EXP",
    "MECH_PQ_THD_VA", "MECH_PQ_THD_VB", "MECH_PQ_THD_VC",
    "MECH_PQ_THD_IA", "MECH_PQ_THD_IB", "MECH_PQ_THD_IC",
    "MECH_PQ_CFG_THD_PCT",
    "MECH_PQ_CFG_NOM_V",
    "MECH_PQ_CFG_UV_V",
  };
  for (uint8_t i = 0; i < sizeof(live) / sizeof(live[0]); i++) {
    mvEnsureTag(live[i], MV_REAL);
  }
  mvEnsureTag("MECH_PQ_THD_ALM", MV_BOOL);
  if (mvGetReal("MECH_PQ_CFG_THD_PCT") <= 0.0f) {
    mvSetReal("MECH_PQ_CFG_THD_PCT", 8.0f);
  }
}

static bool readHoldingBlock(uint16_t start, uint16_t count, uint16_t* out) {
  if (!out || count == 0) return false;
  if (!ModbusRTUClient.requestFrom(MV_EZMETER_SLAVE_ID, HOLDING_REGISTERS, start, count)) {
    return false;
  }
  for (uint16_t i = 0; i < count; i++) {
    if (!ModbusRTUClient.available()) return false;
    out[i] = ModbusRTUClient.read();
  }
  return true;
}

static void updateThdEstimates() {
  const float pfA = mvGetReal("DDS_PF_A");
  const float pfB = mvGetReal("DDS_PF_B");
  const float pfC = mvGetReal("DDS_PF_C");
  const float thd = thdPctFromPf(pfA);
  const float thdB = thdPctFromPf(pfB);
  const float thdC = thdPctFromPf(pfC);
  mvSetReal("MECH_PQ_THD_VA", thd);
  mvSetReal("MECH_PQ_THD_VB", thdB);
  mvSetReal("MECH_PQ_THD_VC", thdC);
  mvSetReal("MECH_PQ_THD_IA", thd);
  mvSetReal("MECH_PQ_THD_IB", thdB);
  mvSetReal("MECH_PQ_THD_IC", thdC);
  const float limit = mvGetReal("MECH_PQ_CFG_THD_PCT");
  const bool alm = (thd > limit) || (thdB > limit) || (thdC > limit);
  mvSetBool("MECH_PQ_THD_ALM", alm);
}

static void decodeLiveAnalog(const uint16_t* buf) {
  mvSetReal("DDS_V_A", buf[0] * 0.1f);
  mvSetReal("DDS_I_A", buf[1] * 0.1f);
  mvSetReal("DDS_W_A", combineWords32(buf[2], buf[3], true) * 0.1f);
  mvSetReal("DDS_HZ_A", buf[4] * 0.1f);
  mvSetReal("DDS_PF_A", signExtend16(buf[5]) * 0.01f);

  mvSetReal("DDS_V_B", buf[6] * 0.1f);
  mvSetReal("DDS_I_B", buf[7] * 0.1f);
  mvSetReal("DDS_W_B", combineWords32(buf[8], buf[9], true) * 0.1f);
  mvSetReal("DDS_HZ_B", buf[10] * 0.1f);
  mvSetReal("DDS_PF_B", signExtend16(buf[11]) * 0.01f);

  mvSetReal("DDS_V_C", buf[12] * 0.1f);
  mvSetReal("DDS_I_C", buf[13] * 0.1f);
  mvSetReal("DDS_W_C", combineWords32(buf[14], buf[15], true) * 0.1f);
  mvSetReal("DDS_HZ_C", buf[16] * 0.1f);
  mvSetReal("DDS_PF_C", signExtend16(buf[17]) * 0.01f);

  mvSetReal("DDS_VA_A", combineWords32(buf[18], buf[19], true) * 0.1f);
  mvSetReal("DDS_VA_B", combineWords32(buf[20], buf[21], true) * 0.1f);
  mvSetReal("DDS_VA_C", combineWords32(buf[22], buf[23], true) * 0.1f);
}

static void decodeEnergy(const uint16_t* buf) {
  const float whImp = (float)combineWords32(buf[16], buf[17], false) * 10.0f;
  const float whExp = (float)combineWords32(buf[18], buf[19], false) * 10.0f;
  mvSetReal("DDS_WH_SUM_IMP", whImp);
  mvSetReal("DDS_WH_SUM_EXP", whExp);
  mvSetReal("MECH_METER_KWH", whImp * 0.001f);
  mvSetReal("MECH_METER_KWH_EXP", whExp * 0.001f);
}

void mvEzmeterBegin() {
  mvEzNvLoad(&g_ezNv);
  g_ezNvLoaded = true;
  ensureEzmeterTags();
  mvEzmeterApplyPqConfig();
#if defined(ARDUINO_OPTA)
  RS485.setDelays(1000, 1000);
  RS485.setPins(RS485_DEFAULT_DE_PIN, RS485_DEFAULT_RE_PIN);
#endif
  if (!ModbusRTUClient.begin(MV_EZMETER_BAUD, SERIAL_8N1)) {
    MV_LOG("[EZM] Modbus RTU client begin failed");
    g_ready = false;
    return;
  }
  g_ready = true;
  MV_LOG2("[EZM] RS485 EZ Meter poll slave=", MV_EZMETER_SLAVE_ID);
}

void mvEzmeterTick(uint32_t nowMs) {
  if (!g_ready) return;

  if (g_lastLivePollMs == 0 || nowMs - g_lastLivePollMs >= MV_EZMETER_LIVE_POLL_MS) {
    g_lastLivePollMs = nowMs;
    uint16_t live[24];
    if (readHoldingBlock(24, 24, live)) {
      decodeLiveAnalog(live);
      updateThdEstimates();
      g_lastPollOk = true;
    } else {
      g_lastPollOk = false;
      MV_LOG("[EZM] live analog poll failed");
    }
  }

  if (g_lastEnergyPollMs == 0 || nowMs - g_lastEnergyPollMs >= MV_EZMETER_ENERGY_POLL_MS) {
    g_lastEnergyPollMs = nowMs;
    uint16_t energy[20];
    if (readHoldingBlock(0, 20, energy)) {
      decodeEnergy(energy);
    }
  }
}

bool mvEzmeterReady() {
  return g_ready;
}

const char* mvEzmeterHealth() {
  if (!g_ready) return "disabled";
  return g_lastPollOk ? "OK" : "poll_err";
}

#endif
