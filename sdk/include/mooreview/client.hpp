#pragma once

#include <memory>
#include <string>
#include <vector>

#include "mooreview/config.hpp"
#include "mooreview/error.hpp"
#include "mooreview/http_transport.hpp"
#include "mooreview/types.hpp"

namespace mooreview {

/** HTTP client for the MooreVIEW embedded runtime (est, default :3080). */
class Client {
 public:
  explicit Client(ClientConfig config);
  Client(ClientConfig config, std::unique_ptr<HttpTransport> transport);
  ~Client();

  Client(const Client&) = delete;
  Client& operator=(const Client&) = delete;

  const ClientConfig& config() const { return config_; }

  Result<TagsResponse> get_tags();
  Result<void> put_tags(const std::vector<Tag>& tags);

  Result<RuntimeStatus> runtime_status();
  Result<RuntimeStatus> runtime_start();
  Result<RuntimeStatus> runtime_stop();

  Result<ProgramResponse> get_program();
  Result<ProgramPutResult> put_program(const std::string& source);
  Result<ProgramValidateResult> validate_program(const std::string& source);

  Result<std::string> get_settings_json();
  Result<void> put_settings_json(const std::string& json);

  Result<std::string> export_config_json();
  Result<void> import_config_json(const std::string& json);

  Result<std::string> get_drivers_json();
  Result<void> put_drivers_json(const std::string& json);

  Result<void> set_force(const ForceRequest& req);
  Result<void> clear_force(const std::string& tag_id, const std::string& which = "");

  Result<std::string> get_graph_history(const std::vector<std::string>& tag_ids, int limit = 300);
  Result<void> clear_graph(const std::string& tag_id = "");

  Result<std::string> raw_get(const std::string& path);
  Result<std::string> raw_put(const std::string& path, const std::string& json_body);
  Result<std::string> raw_post(const std::string& path, const std::string& json_body);
  Result<std::string> raw_delete(const std::string& path);

 private:
  ClientConfig config_;
  std::unique_ptr<HttpTransport> transport_;
  std::unique_ptr<HttpTransport> owned_transport_;

  std::string base_url() const;
  Result<std::string> api_request(
      const std::string& method,
      const std::string& path,
      const std::string& body = "");
};

}  // namespace mooreview
