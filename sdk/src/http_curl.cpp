#include "mooreview/http_transport.hpp"

#include <curl/curl.h>
#include <map>
#include <memory>
#include <sstream>
#include <stdexcept>

namespace mooreview {

namespace {

size_t write_callback(char* ptr, size_t size, size_t nmemb, void* userdata) {
  auto* out = static_cast<std::string*>(userdata);
  out->append(ptr, size * nmemb);
  return size * nmemb;
}

void ensure_curl_global_init() {
  static bool done = false;
  if (!done) {
    curl_global_init(CURL_GLOBAL_DEFAULT);
    done = true;
  }
}

class CurlTransport : public HttpTransport {
 public:
  explicit CurlTransport(long timeout_ms) : timeout_ms_(timeout_ms) {
    ensure_curl_global_init();
  }

  ~CurlTransport() override = default;

  HttpResponse request(
      const std::string& method,
      const std::string& url,
      const std::string& body,
      const std::map<std::string, std::string>& headers) override {
    HttpResponse resp;
    CURL* curl = curl_easy_init();
    if (!curl) return resp;

    std::string response_body;
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_body);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, timeout_ms_);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT_MS, timeout_ms_);
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_TCP_KEEPALIVE, 1L);

    struct curl_slist* hdrs = nullptr;
    hdrs = curl_slist_append(hdrs, "Accept: application/json");
    if (!body.empty()) hdrs = curl_slist_append(hdrs, "Content-Type: application/json");
    for (const auto& kv : headers) {
      std::string line = kv.first + ": " + kv.second;
      hdrs = curl_slist_append(hdrs, line.c_str());
    }
    if (hdrs) curl_easy_setopt(curl, CURLOPT_HTTPHEADER, hdrs);

    if (method == "POST") {
      curl_easy_setopt(curl, CURLOPT_POST, 1L);
      curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());
      curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(body.size()));
    } else if (method == "PUT") {
      curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "PUT");
      curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());
      curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(body.size()));
    } else if (method == "DELETE") {
      curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "DELETE");
    } else {
      curl_easy_setopt(curl, CURLOPT_HTTPGET, 1L);
    }

    CURLcode code = curl_easy_perform(curl);
    if (code == CURLE_OK) {
      long status = 0;
      curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &status);
      resp.status = static_cast<int>(status);
      resp.body = std::move(response_body);
    } else {
      resp.status = 0;
      resp.body = curl_easy_strerror(code);
    }

    if (hdrs) curl_slist_free_all(hdrs);
    curl_easy_cleanup(curl);
    return resp;
  }

 private:
  long timeout_ms_;
};

}  // namespace

HttpTransport* create_curl_transport(long timeout_ms) {
  return new CurlTransport(timeout_ms);
}

}  // namespace mooreview
