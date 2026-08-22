#pragma once

#include <map>
#include <string>

namespace mooreview {

struct HttpResponse {
  int status = 0;
  std::string body;
};

class HttpTransport {
 public:
  virtual ~HttpTransport() = default;

  virtual HttpResponse request(
      const std::string& method,
      const std::string& url,
      const std::string& body,
      const std::map<std::string, std::string>& headers) = 0;
};

HttpTransport* create_curl_transport(long timeout_ms);

}  // namespace mooreview
