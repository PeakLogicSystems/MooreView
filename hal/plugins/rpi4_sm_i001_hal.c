/**
 * MooreVIEW HAL plugin — Raspberry Pi 4 + Sequent Microsystems SM-I-001
 * (Industrial Automation 8-layer stackable HAT, SKU SM-I-001).
 *
 * Hardware (per channel, megaind channel numbers are 1-based):
 *   DI0–DI3  opto-isolated digital inputs
 *   DO0–DO3  open-drain MOSFET outputs
 *   AI0–AI3  0–10 V analog inputs (tag INT = millivolts)
 *   AI4–AI7  4–20 mA analog inputs (tag INT = microamps)
 *   AO0–AO3  0–10 V analog outputs (tag REAL = volts)
 *   AO4–AO7  4–20 mA analog outputs (tag REAL = milliamps)
 *   CNT0–CNT3  opto pulse counters (+ freq via field on REAL tag)
 *
 * Prereqs on Pi 4:
 *   sudo raspi-config  → Interface Options → I2C → Enable
 *   i2cdetect -y 1     → card at 0x50 (stack 0) … 0x57 (stack 7)
 *
 * Build (on the Pi):
 *   cd hal/plugins && make sm_i001 && sudo make install-sm_i001
 *
 * Driver JSON (halConfig is passed to mooreview_hal_init):
 *   { "stack": 0, "i2cBus": 1 }
 *
 * Optional: install Sequent megaind CLI for bench testing:
 *   git clone https://github.com/SequentMicrosystems/megaind-rpi.git
 *   cd megaind-rpi && sudo make install && megaind -list
 */
#include "../../native/hal_plugin.h"
#include "sm_i001_regs.h"
#include "sm_i001_i2c.h"

#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

static int g_fd = -1;
static int g_stack = 0;
static int g_i2c_bus = 1;

/* HAL pin index (0-based) → megaind channel (1-based). */
static int hw_ch(int index) { return index + SM_I001_CH_MIN; }

static int parse_config(const char* json) {
  int stack = 0;
  int bus = 1;
  const char* p;

  if (!json || !json[0]) {
    g_stack = 0;
    g_i2c_bus = 1;
    return 0;
  }
  p = strstr(json, "\"stack\"");
  if (p) sscanf(p, "\"stack\"%*[^0-9-]%d", &stack);
  p = strstr(json, "\"i2cBus\"");
  if (p) sscanf(p, "\"i2cBus\"%*[^0-9-]%d", &bus);
  if (stack < 0) stack = 0;
  if (stack > SM_I001_STACK_MAX) stack = SM_I001_STACK_MAX;
  if (bus < 0) bus = 0;
  if (bus > 10) bus = 10;
  g_stack = stack;
  g_i2c_bus = bus;
  return 0;
}

static int val16_get(int base_reg, int ch, float scale, float* out) {
  uint8_t buf[2];
  int16_t raw;

  if (!out || ch < SM_I001_CH_MIN) return -1;
  if (sm_i001_i2c_read8(g_fd, base_reg + 2 * (ch - 1), buf, 2) != 0) return -2;
  memcpy(&raw, buf, 2);
  *out = (float)raw / scale;
  return 0;
}

static int val16_set(int base_reg, int ch, float scale, float val) {
  uint8_t buf[2];
  int16_t raw;

  if (ch < SM_I001_CH_MIN) return -1;
  raw = (int16_t)ceilf(val * scale);
  memcpy(buf, &raw, 2);
  if (sm_i001_i2c_write8(g_fd, base_reg + 2 * (ch - 1), buf, 2) != 0) return -2;
  return 0;
}

static int opto_bit(int ch, int* on) {
  uint8_t buf[1];
  int c = hw_ch(ch);

  if (!on || c < SM_I001_CH_MIN || c > SM_I001_OPTO_MAX) return -1;
  if (sm_i001_i2c_read8(g_fd, SM_I001_MEM_OPTO_IN_VAL, buf, 1) != 0) return -2;
  *on = (buf[0] & (1u << (c - 1))) ? 1 : 0;
  return 0;
}

static int od_set(int ch, int on) {
  uint8_t buf[1];
  int c = hw_ch(ch);

  if (c < SM_I001_CH_MIN || c > SM_I001_OD_MAX) return -1;
  buf[0] = (uint8_t)c;
  if (on) {
    if (sm_i001_i2c_write8(g_fd, SM_I001_MEM_RELAY_SET, buf, 1) != 0) return -2;
  } else {
    if (sm_i001_i2c_write8(g_fd, SM_I001_MEM_RELAY_CLR, buf, 1) != 0) return -2;
  }
  return 0;
}

static int od_get(int ch, int* on) {
  uint8_t buf[1];
  int c = hw_ch(ch);

  if (!on || c < SM_I001_CH_MIN || c > SM_I001_OD_MAX) return -1;
  if (sm_i001_i2c_read8(g_fd, SM_I001_MEM_RELAY_VAL, buf, 1) != 0) return -2;
  *on = (buf[0] & (1u << (c - 1))) ? 1 : 0;
  return 0;
}

static int counter_enable_rising(int ch) {
  uint8_t buf[1];
  int c = hw_ch(ch);

  if (c < SM_I001_CH_MIN || c > SM_I001_OPTO_MAX) return -1;
  if (sm_i001_i2c_read8(g_fd, SM_I001_MEM_OPTO_RISING_ENABLE, buf, 1) != 0) return -2;
  buf[0] |= (uint8_t)(1u << (c - 1));
  if (sm_i001_i2c_write8(g_fd, SM_I001_MEM_OPTO_RISING_ENABLE, buf, 1) != 0) return -3;
  return 0;
}

int mooreview_hal_init(const char* config_json) {
  uint8_t rev[1];
  int addr;

  parse_config(config_json);
  if (g_fd >= 0) {
    sm_i001_i2c_close(g_fd);
    g_fd = -1;
  }

  addr = SM_I001_SLAVE_BASE + g_stack;
  g_fd = sm_i001_i2c_open(g_i2c_bus, addr);
  if (g_fd < 0) return -1;

  if (sm_i001_i2c_read8(g_fd, SM_I001_MEM_REVISION_MAJOR, rev, 1) != 0) {
    sm_i001_i2c_close(g_fd);
    g_fd = -1;
    return -2;
  }

  for (int i = 0; i < SM_I001_OPTO_MAX; i++) {
    counter_enable_rising(i);
  }
  return 0;
}

void mooreview_hal_shutdown(void) {
  if (g_fd >= 0) {
    sm_i001_i2c_close(g_fd);
    g_fd = -1;
  }
}

int mooreview_hal_read(enum mooreview_hal_kind kind, int index, double* out) {
  float f;
  int bit;

  if (!out || g_fd < 0 || index < 0) return -1;

  switch (kind) {
    case MV_HAL_DI:
      if (index >= SM_I001_OPTO_MAX) return -2;
      if (opto_bit(index, &bit) != 0) return -3;
      *out = bit ? 1.0 : 0.0;
      return 0;

    case MV_HAL_DO:
      if (index >= SM_I001_OD_MAX) return -2;
      if (od_get(index, &bit) != 0) return -3;
      *out = bit ? 1.0 : 0.0;
      return 0;

    case MV_HAL_AI:
      if (index < SM_I001_U_IN_MAX) {
        if (val16_get(SM_I001_MEM_U0_10_IN_VAL1, hw_ch(index), SM_I001_VOLT_SCALE, &f) != 0) return -3;
        *out = (double)(f * SM_I001_VOLT_SCALE); /* millivolts for INT tags */
        return 0;
      }
      if (index < SM_I001_U_IN_MAX + SM_I001_I_IN_MAX) {
        int ch = hw_ch(index - SM_I001_U_IN_MAX);
        if (val16_get(SM_I001_MEM_I4_20_IN_VAL1, ch, SM_I001_MA_SCALE, &f) != 0) return -3;
        *out = (double)(f * SM_I001_MA_SCALE); /* microamps for INT tags */
        return 0;
      }
      return -2;

    case MV_HAL_AO:
      if (index < SM_I001_U_OUT_MAX) {
        if (val16_get(SM_I001_MEM_U0_10_OUT_VAL1, hw_ch(index), SM_I001_VOLT_SCALE, &f) != 0) return -3;
        *out = (double)f;
        return 0;
      }
      if (index < SM_I001_U_OUT_MAX + SM_I001_I_OUT_MAX) {
        int ch = hw_ch(index - SM_I001_U_OUT_MAX);
        if (val16_get(SM_I001_MEM_I4_20_OUT_VAL1, ch, SM_I001_MA_SCALE, &f) != 0) return -3;
        *out = (double)f;
        return 0;
      }
      return -2;

    case MV_HAL_CNT:
      if (index >= SM_I001_OPTO_MAX) return -2;
      if (val16_get(SM_I001_MEM_OPTO_COUNT1, hw_ch(index), 1.0f, &f) != 0) return -3;
      *out = (double)f;
      return 0;

    default:
      return -4;
  }
}

int mooreview_hal_write(enum mooreview_hal_kind kind, int index, double value) {
  if (g_fd < 0 || index < 0) return -1;

  if (kind == MV_HAL_DO) {
    if (index >= SM_I001_OD_MAX) return -2;
    return od_set(index, value >= 0.5 ? 1 : 0) == 0 ? 0 : -3;
  }

  if (kind == MV_HAL_AO) {
    if (index < SM_I001_U_OUT_MAX) {
      return val16_set(SM_I001_MEM_U0_10_OUT_VAL1, hw_ch(index), SM_I001_VOLT_SCALE, (float)value) == 0 ? 0 : -3;
    }
    if (index < SM_I001_U_OUT_MAX + SM_I001_I_OUT_MAX) {
      int ch = hw_ch(index - SM_I001_U_OUT_MAX);
      return val16_set(SM_I001_MEM_I4_20_OUT_VAL1, ch, SM_I001_MA_SCALE, (float)value) == 0 ? 0 : -3;
    }
    return -2;
  }

  return -4;
}

int mooreview_hal_counter_read(int index, unsigned long long* count, double* freq_hz) {
  float c = 0.0f;
  float hz = 0.0f;

  if (!count || g_fd < 0 || index < 0 || index >= SM_I001_OPTO_MAX) return -1;
  if (val16_get(SM_I001_MEM_OPTO_COUNT1, hw_ch(index), 1.0f, &c) != 0) return -2;
  *count = (unsigned long long)c;
  if (freq_hz) {
    if (val16_get(SM_I001_MEM_OPTO_FREQ1, hw_ch(index), 1.0f, &hz) != 0) hz = 0.0f;
    *freq_hz = (double)hz;
  }
  return 0;
}
