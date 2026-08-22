#include "mv_fieldbus.h"
#include "mv_ezmeter.h"
#include "mv_debug.h"

#if MV_FIELDBUS

void mvFieldbusInit(const MvFieldbusConfig* cfg) {
  (void)cfg;
#if MV_EZMETER
  mvEzmeterBegin();
#else
  MV_LOG("[MVFB] fieldbus enabled — no device profile (set MV_EZMETER=1)");
#endif
}

void mvFieldbusTick(uint32_t nowMs) {
#if MV_EZMETER
  mvEzmeterTick(nowMs);
#endif
}

bool mvFieldbusReady() {
#if MV_EZMETER
  return mvEzmeterReady();
#endif
  return false;
}

const char* mvFieldbusHealth() {
#if MV_EZMETER
  return mvEzmeterHealth();
#endif
  return "disabled";
}

void mvFieldbusSyncTags() {
  /* Tags updated inline during mvEzmeterTick. */
}

#else

void mvFieldbusInit(const MvFieldbusConfig* cfg) {
  (void)cfg;
}

void mvFieldbusTick(uint32_t nowMs) {
  (void)nowMs;
}

bool mvFieldbusReady() {
  return false;
}

const char* mvFieldbusHealth() {
  return "disabled";
}

void mvFieldbusSyncTags() {}

#endif
