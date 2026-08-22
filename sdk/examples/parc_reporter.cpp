/**
 * Edge Parc reporter — snapshot local runtime to central HMI on a schedule.
 *
 * Local runtime (est): MV_LOCAL_HOST / MV_LOCAL_PORT  (default 127.0.0.1:3080)
 * Central HMI (est-pc): MV_CENTRAL_HOST / MV_CENTRAL_PORT (default PC LAN IP:3090)
 *
 * Env:
 *   MV_DEVICE_ID     required unique id (e.g. site-router-01)
 *   MV_DEVICE_NAME   optional display name
 *   MV_PLATFORM      e.g. openwrt-mips, rpi-aarch64
 *   MV_REPORT_SEC    default 300 (5 min); central may override while debugging
 */

#include <chrono>
#include <cstdlib>
#include <iostream>
#include <thread>

#include "mooreview/mooreview.hpp"

static uint64_t now_ms() {
  using clock = std::chrono::steady_clock;
  return static_cast<uint64_t>(
      std::chrono::duration_cast<std::chrono::milliseconds>(clock::now().time_since_epoch())
          .count());
}

int main() {
  const char* device_id = std::getenv("MV_DEVICE_ID");
  if (!device_id || !*device_id) {
    std::cerr << "MV_DEVICE_ID is required\n";
    return 1;
  }

  mooreview::ReporterConfig cfg;
  cfg.device_id = device_id;
  if (const char* n = std::getenv("MV_DEVICE_NAME")) cfg.device_name = n;
  if (const char* p = std::getenv("MV_PLATFORM")) cfg.platform = p;
  if (const char* s = std::getenv("MV_REPORT_SEC")) cfg.report_interval_sec = std::atoi(s);

  if (const char* h = std::getenv("MV_LOCAL_HOST")) cfg.local_runtime.host = h;
  if (const char* p = std::getenv("MV_LOCAL_PORT")) cfg.local_runtime.port = static_cast<uint16_t>(std::atoi(p));
  if (const char* h = std::getenv("MV_CENTRAL_HOST")) cfg.central_hmi.host = h;
  if (const char* p = std::getenv("MV_CENTRAL_PORT")) cfg.central_hmi.port = static_cast<uint16_t>(std::atoi(p));
  if (const char* t = std::getenv("MV_CENTRAL_TOKEN")) cfg.central_hmi.bearer_token = t;

  if (cfg.central_hmi.host.empty() || cfg.central_hmi.host == "127.0.0.1") {
    std::cerr << "Set MV_CENTRAL_HOST to the engineering HMI (est-pc) LAN address\n";
    return 1;
  }

  mooreview::ParcReporter reporter(cfg);

  std::cout << "Parc reporter " << cfg.device_id
            << " local=" << cfg.local_runtime.host << ":" << cfg.local_runtime.port
            << " central=" << cfg.central_hmi.host << ":" << cfg.central_hmi.port
            << " interval=" << cfg.report_interval_sec << "s\n";

  while (true) {
    auto r = reporter.tick(now_ms());
    if (!r.ok) {
      std::cerr << "report failed: " << r.error.message << "\n";
    } else if (r.value.pause_reports) {
      std::cout << "debug attach active — reports paused (central HMI uses direct :3080)\n";
    }
    std::this_thread::sleep_for(std::chrono::seconds(1));
  }
  return 0;
}
