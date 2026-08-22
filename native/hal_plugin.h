/**
 * MooreVIEW HAL board plugin C API (Linux shared library).
 *
 * Export these symbols from libmyboard_hal.so:
 *   mooreview_hal_init, mooreview_hal_shutdown,
 *   mooreview_hal_read, mooreview_hal_write, mooreview_hal_counter_read
 *
 * Build example: hal/plugins/example_hal.c
 */
#ifndef MOOREVIEW_HAL_PLUGIN_H
#define MOOREVIEW_HAL_PLUGIN_H

#ifdef __cplusplus
extern "C" {
#endif

enum mooreview_hal_kind {
  MV_HAL_DI = 0,
  MV_HAL_DO = 1,
  MV_HAL_AI = 2,
  MV_HAL_AO = 3,
  MV_HAL_CNT = 4,
};

/** Return 0 on success. config_json is driver-specific (GPIO map, sysfs paths, etc.). */
int mooreview_hal_init(const char* config_json);

void mooreview_hal_shutdown(void);

/** Read channel value into *out (BOOL/INT/REAL as double). Return 0 on success. */
int mooreview_hal_read(enum mooreview_hal_kind kind, int index, double* out);

/** Write DO/AO. Return 0 on success. */
int mooreview_hal_write(enum mooreview_hal_kind kind, int index, double value);

/** Hardware counter: pulse count and estimated frequency (Hz). */
int mooreview_hal_counter_read(int index, unsigned long long* count, double* freq_hz);

#ifdef __cplusplus
}
#endif

#endif
