#pragma once

#include <cstdint>
#include <string>

namespace mooreview {

struct ClientConfig {
  std::string host = "127.0.0.1";
  uint16_t port = 3080;
  std::string api_prefix = "/api";
  std::string bearer_token;
  long timeout_ms = 5000;
  bool use_tls = false;
};

}  // namespace mooreview
