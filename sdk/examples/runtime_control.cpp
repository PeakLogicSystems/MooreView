/**
 * Start/stop/status for the MooreVIEW scan runtime (local :3080).
 *
 * Usage:
 *   mv_runtime_control start
 *   mv_runtime_control stop
 *   mv_runtime_control status
 */

#include <cstdlib>
#include <iostream>
#include <string>

#include "mooreview/mooreview.hpp"

int main(int argc, char** argv) {
  std::string cmd = argc > 1 ? argv[1] : "status";

  mooreview::ClientConfig cfg;
  if (const char* h = std::getenv("MV_HOST")) cfg.host = h;
  if (const char* p = std::getenv("MV_PORT")) cfg.port = static_cast<uint16_t>(std::atoi(p));

  mooreview::Client client(cfg);
  mooreview::Result<mooreview::RuntimeStatus> r;

  if (cmd == "start") r = client.runtime_start();
  else if (cmd == "stop") r = client.runtime_stop();
  else r = client.runtime_status();

  if (!r.ok) {
    std::cerr << cmd << " failed: " << r.error.message << "\n";
    return 1;
  }

  std::cout << "running=" << (r.value.running ? "true" : "false")
            << " scanMs=" << r.value.scan_ms
            << " lastCycleMs=" << r.value.last_cycle_ms
            << " cycles=" << r.value.cycles
            << " programOk=" << (r.value.program_ok ? "true" : "false")
            << "\n";
  return 0;
}
