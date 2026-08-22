/**
 * Poll tags from a local MooreVIEW embedded runtime.
 *
 * Targets: OpenWrt MIPS router, Raspberry Pi 4/5 (aarch64), or any Linux host
 * running est on loopback.
 *
 * Default: http://127.0.0.1:3080
 *
 * Build:
 *   cmake -S . -B build && cmake --build build
 *   ./build/mv_poll_tags
 *
 * Env: MV_HOST, MV_PORT, MV_TOKEN (optional bearer)
 */

#include <cstdlib>
#include <iostream>

#include "mooreview/mooreview.hpp"

int main() {
  mooreview::ClientConfig cfg;
  if (const char* h = std::getenv("MV_HOST")) cfg.host = h;
  if (const char* p = std::getenv("MV_PORT")) cfg.port = static_cast<uint16_t>(std::atoi(p));
  if (const char* t = std::getenv("MV_TOKEN")) cfg.bearer_token = t;

  mooreview::Client client(cfg);

  auto tags = client.get_tags();
  if (!tags.ok) {
    std::cerr << "get_tags failed: " << tags.error.message << "\n";
    return 1;
  }

  std::cout << "tags=" << tags.value.count << "/" << tags.value.max << "\n";
  for (const auto& t : tags.value.tags) {
    std::cout << "  " << t.id << " ";
    if (t.type == mooreview::TagType::Bool)
      std::cout << (t.value_bool ? "true" : "false");
    else if (t.type == mooreview::TagType::Real)
      std::cout << t.value_real;
    else
      std::cout << t.value_int;
    std::cout << "\n";
  }

  auto rt = client.runtime_status();
  if (rt.ok) {
    std::cout << "runtime: " << (rt.value.running ? "running" : "stopped")
              << " cycles=" << rt.value.cycles << "\n";
  }
  return 0;
}
