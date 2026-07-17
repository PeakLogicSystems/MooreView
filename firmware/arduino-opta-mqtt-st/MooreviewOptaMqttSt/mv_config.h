#pragma once

/* HTTP uses native EthernetServer on Opta (see mv_http.cpp). */
#ifndef MV_HAS_WEBSERVER
#if defined(ARDUINO_OPTA) || defined(ARDUINO_PORTENTA_H7_M7)
#define MV_HAS_WEBSERVER 1
#else
#define MV_HAS_WEBSERVER 0
#endif
#endif

#ifndef MV_DEBUG_VERBOSE
#define MV_DEBUG_VERBOSE 1
#endif

#define MV_HTTP_PORT 80
#define MV_WIFI_HTTP_PORT 8080
#define MV_MAX_TAGS 128
#define MV_AVG_RING 16
#define MV_PROGRAM_JSON_MAX 8192
#define MV_BC_MAX 16384
#define MV_SCAN_MS_DEFAULT 100

// WiFi setup AP (Opta WiFi variant)
#ifndef MV_WIFI_AP_SSID
#define MV_WIFI_AP_SSID "MooreVIEW-Opta"
#endif
#ifndef MV_WIFI_AP_PASS
#define MV_WIFI_AP_PASS "mooreview"
#endif
#ifndef MV_WIFI_AP_IP
#define MV_WIFI_AP_IP 192, 168, 4, 1
#endif

// Opta pin map (adjust for your model — see README)
#ifndef MV_DIN_PIN0
#define MV_DIN_PIN0 A0
#endif
#ifndef MV_RELAY_PIN0
#define MV_RELAY_PIN0 D0
#endif

#ifndef MV_OTA_PASSWORD
#define MV_OTA_PASSWORD ""
#endif

#ifndef MV_OTA_QSPI_OFFSET
#define MV_OTA_QSPI_OFFSET 2
#endif
