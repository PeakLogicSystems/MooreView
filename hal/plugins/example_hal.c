/**
 * Example MooreVIEW HAL plugin — in-memory stub for desktop development.
 *
 *   cd hal/plugins && make example
 *
 * Production board example: Raspberry Pi 4 + Sequent SM-I-001 → rpi4_sm_i001_hal.c
 *   make sm_i001 && sudo make install-sm_i001
 *   See README_SM-I-001.md
 *
 * Channels: DI/DO (digital), AI (analog in), AO (analog out), CNT (pulse counters).
 */
#include "../../native/hal_plugin.h"
#include <string.h>

#define HAL_DI_MAX 32
#define HAL_DO_MAX 32
#define HAL_AI_MAX 16
#define HAL_AO_MAX 8
#define HAL_CNT_MAX 8

static unsigned long long g_cnt[HAL_CNT_MAX];
static double g_ai[HAL_AI_MAX];
static double g_ao[HAL_AO_MAX];
static int g_di[HAL_DI_MAX];
static int g_do[HAL_DO_MAX];

int mooreview_hal_init(const char* config_json) {
  (void)config_json;
  memset(g_cnt, 0, sizeof(g_cnt));
  memset(g_ai, 0, sizeof(g_ai));
  memset(g_ao, 0, sizeof(g_ao));
  memset(g_di, 0, sizeof(g_di));
  memset(g_do, 0, sizeof(g_do));
  return 0;
}

void mooreview_hal_shutdown(void) {}

int mooreview_hal_read(enum mooreview_hal_kind kind, int index, double* out) {
  if (!out || index < 0) return -1;
  switch (kind) {
    case MV_HAL_DI:
      if (index >= HAL_DI_MAX) return -2;
      *out = g_di[index] ? 1.0 : 0.0;
      return 0;
    case MV_HAL_DO:
      if (index >= HAL_DO_MAX) return -2;
      *out = g_do[index] ? 1.0 : 0.0;
      return 0;
    case MV_HAL_AI:
      if (index >= HAL_AI_MAX) return -2;
      *out = g_ai[index];
      return 0;
    case MV_HAL_AO:
      if (index >= HAL_AO_MAX) return -2;
      *out = g_ao[index];
      return 0;
    case MV_HAL_CNT:
      if (index >= HAL_CNT_MAX) return -2;
      *out = (double)g_cnt[index];
      return 0;
    default:
      return -3;
  }
}

int mooreview_hal_write(enum mooreview_hal_kind kind, int index, double value) {
  if (index < 0) return -1;
  if (kind == MV_HAL_DO) {
    if (index >= HAL_DO_MAX) return -2;
    g_do[index] = value >= 0.5 ? 1 : 0;
    return 0;
  }
  if (kind == MV_HAL_AO) {
    if (index >= HAL_AO_MAX) return -2;
    g_ao[index] = value;
    return 0;
  }
  return -3;
}

int mooreview_hal_counter_read(int index, unsigned long long* count, double* freq_hz) {
  if (!count || index < 0 || index >= HAL_CNT_MAX) return -1;
  *count = g_cnt[index];
  if (freq_hz) *freq_hz = 0.0;
  return 0;
}
