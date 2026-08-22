#pragma once

#include <Arduino.h>
#include "mv_config.h"

/**
 * EZ Meter DDS-RGB Modbus RTU poll on Opta onboard RS485 (fieldbus master).
 * Enable with MV_FIELDBUS=1 and MV_EZMETER=1 compile flags.
 * Publishes DDS_* live analog tags + MECH_PQ_THD_* estimates via MQTT Parc.
 */

#ifndef MV_EZMETER
#define MV_EZMETER 0
#endif

#ifndef MV_EZMETER_SLAVE_ID
#define MV_EZMETER_SLAVE_ID 1
#endif

#ifndef MV_EZMETER_BAUD
#define MV_EZMETER_BAUD 9600
#endif

#ifndef MV_EZMETER_LIVE_POLL_MS
#define MV_EZMETER_LIVE_POLL_MS 30000
#endif

#ifndef MV_EZMETER_ENERGY_POLL_MS
#define MV_EZMETER_ENERGY_POLL_MS 300000
#endif

void mvEzmeterBegin();
void mvEzmeterTick(uint32_t nowMs);
bool mvEzmeterReady();
const char* mvEzmeterHealth();

/** Low-voltage threshold (V) persisted on Opta; 0 = use default 108. */
float mvEzmeterUndervoltV();
float mvEzmeterNominalV();
bool mvEzmeterSetUndervoltV(float volts);
bool mvEzmeterSetNominalV(float volts);
void mvEzmeterApplyPqConfig();

#if !(MV_FIELDBUS && MV_EZMETER)
inline void mvEzmeterBegin() {}
inline void mvEzmeterTick(uint32_t) {}
inline bool mvEzmeterReady() { return false; }
inline const char* mvEzmeterHealth() { return "disabled"; }
inline float mvEzmeterUndervoltV() { return 108.0f; }
inline float mvEzmeterNominalV() { return 120.0f; }
inline bool mvEzmeterSetUndervoltV(float) { return false; }
inline bool mvEzmeterSetNominalV(float) { return false; }
inline void mvEzmeterApplyPqConfig() {}
#endif
