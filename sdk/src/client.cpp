#include "mooreview/client.hpp"

#include <sstream>

#include "json_helpers.hpp"

namespace mooreview {

namespace {

std::string join_path(const std::string& prefix, const std::string& path) {
  if (path.empty()) return prefix;
  if (path[0] == '/') return prefix + path;
  return prefix + "/" + path;
}

}  // namespace

Client::Client(ClientConfig config)
    : config_(std::move(config)) {
  owned_transport_.reset(create_curl_transport(config_.timeout_ms));
  transport_ = owned_transport_.get();
}

Client::Client(ClientConfig config, std::unique_ptr<HttpTransport> transport)
    : config_(std::move(config)), transport_(transport.get()) {
  owned_transport_ = std::move(transport);
}

Client::~Client() = default;

std::string Client::base_url() const {
  std::ostringstream ss;
  ss << (config_.use_tls ? "https://" : "http://") << config_.host;
  if ((config_.use_tls && config_.port != 443) || (!config_.use_tls && config_.port != 80))
    ss << ":" << config_.port;
  ss << config_.api_prefix;
  return ss.str();
}

Result<std::string> Client::api_request(
    const std::string& method,
    const std::string& path,
    const std::string& body) {
  std::map<std::string, std::string> headers;
  if (!config_.bearer_token.empty())
    headers["Authorization"] = "Bearer " + config_.bearer_token;

  const std::string url = base_url() + path;
  HttpResponse resp = transport_->request(method, url, body, headers);
  if (resp.status == 0)
    return Result<std::string>::failure(Error("HTTP transport failed: " + resp.body));
  if (resp.status < 200 || resp.status >= 300) {
    cJSON* root = cJSON_Parse(resp.body.c_str());
    std::string msg = json::error_message(root, "HTTP " + std::to_string(resp.status));
    cJSON_Delete(root);
    return Result<std::string>::failure(Error::http(resp.status, msg));
  }
  return Result<std::string>::success(resp.body);
}

Result<TagsResponse> Client::get_tags() {
  auto r = api_request("GET", "/tags");
  if (!r.ok) return Result<TagsResponse>::failure(r.error);
  return Result<TagsResponse>::success(json::parse_tags_response(r.value));
}

Result<void> Client::put_tags(const std::vector<Tag>& tags) {
  std::ostringstream body;
  body << "{\"tags\":[";
  for (size_t i = 0; i < tags.size(); ++i) {
    if (i) body << ',';
    if (!tags[i].raw_json.empty()) body << tags[i].raw_json;
    else body << "{\"id\":\"" << json::escape(tags[i].id) << "\"}";
  }
  body << "]}";
  auto r = api_request("PUT", "/tags", body.str());
  if (!r.ok) return Result<void>::failure(r.error);
  return Result<void>::success();
}

Result<RuntimeStatus> Client::runtime_status() {
  auto r = api_request("GET", "/runtime/status");
  if (!r.ok) return Result<RuntimeStatus>::failure(r.error);
  return Result<RuntimeStatus>::success(json::parse_runtime_status(r.value));
}

Result<RuntimeStatus> Client::runtime_start() {
  auto r = api_request("POST", "/runtime/start");
  if (!r.ok) return Result<RuntimeStatus>::failure(r.error);
  return Result<RuntimeStatus>::success(json::parse_runtime_status(r.value));
}

Result<RuntimeStatus> Client::runtime_stop() {
  auto r = api_request("POST", "/runtime/stop");
  if (!r.ok) return Result<RuntimeStatus>::failure(r.error);
  return Result<RuntimeStatus>::success(json::parse_runtime_status(r.value));
}

Result<ProgramResponse> Client::get_program() {
  auto r = api_request("GET", "/program");
  if (!r.ok) return Result<ProgramResponse>::failure(r.error);
  return Result<ProgramResponse>::success(json::parse_program_response(r.value));
}

Result<ProgramPutResult> Client::put_program(const std::string& source) {
  std::string body = std::string("{\"source\":\"") + json::escape(source) + "\"}";
  auto r = api_request("PUT", "/program", body);
  if (!r.ok) return Result<ProgramPutResult>::failure(r.error);
  return Result<ProgramPutResult>::success(json::parse_program_put(r.value));
}

Result<ProgramValidateResult> Client::validate_program(const std::string& source) {
  std::string body = std::string("{\"source\":\"") + json::escape(source) + "\"}";
  auto r = api_request("POST", "/program/validate", body);
  if (!r.ok) return Result<ProgramValidateResult>::failure(r.error);
  return Result<ProgramValidateResult>::success(json::parse_program_validate(r.value));
}

Result<std::string> Client::get_settings_json() { return api_request("GET", "/settings"); }
Result<void> Client::put_settings_json(const std::string& json) {
  auto r = api_request("PUT", "/settings", json);
  if (!r.ok) return Result<void>::failure(r.error);
  return Result<void>::success();
}

Result<std::string> Client::export_config_json() { return api_request("GET", "/config/export"); }
Result<void> Client::import_config_json(const std::string& json) {
  auto r = api_request("POST", "/config/import", json);
  if (!r.ok) return Result<void>::failure(r.error);
  return Result<void>::success();
}

Result<std::string> Client::get_drivers_json() { return api_request("GET", "/drivers"); }
Result<void> Client::put_drivers_json(const std::string& json) {
  auto r = api_request("PUT", "/drivers", json);
  if (!r.ok) return Result<void>::failure(r.error);
  return Result<void>::success();
}

Result<void> Client::set_force(const ForceRequest& req) {
  std::ostringstream body;
  body << "{\"tagId\":\"" << json::escape(req.tag_id) << "\""
       << ",\"forceInput\":" << (req.force_input ? "true" : "false")
       << ",\"forceOutput\":" << (req.force_output ? "true" : "false")
       << ",\"forceValue\":" << req.force_value << "}";
  auto r = api_request("POST", "/debug/force", body.str());
  if (!r.ok) return Result<void>::failure(r.error);
  return Result<void>::success();
}

Result<void> Client::clear_force(const std::string& tag_id, const std::string& which) {
  std::string path = "/debug/force?tagId=" + tag_id;
  if (!which.empty()) path += "&which=" + which;
  auto r = api_request("DELETE", path);
  if (!r.ok) return Result<void>::failure(r.error);
  return Result<void>::success();
}

Result<std::string> Client::get_graph_history(const std::vector<std::string>& tag_ids, int limit) {
  std::ostringstream path;
  path << "/graph/history?limit=" << limit;
  if (!tag_ids.empty()) {
    path << "&tags=";
    for (size_t i = 0; i < tag_ids.size(); ++i) {
      if (i) path << ',';
      path << tag_ids[i];
    }
  }
  return api_request("GET", path.str());
}

Result<void> Client::clear_graph(const std::string& tag_id) {
  std::string body = tag_id.empty() ? "{}" : "{\"tagId\":\"" + json::escape(tag_id) + "\"}";
  auto r = api_request("POST", "/graph/clear", body);
  if (!r.ok) return Result<void>::failure(r.error);
  return Result<void>::success();
}

Result<std::string> Client::raw_get(const std::string& path) { return api_request("GET", path); }
Result<std::string> Client::raw_put(const std::string& path, const std::string& json_body) {
  return api_request("PUT", path, json_body);
}
Result<std::string> Client::raw_post(const std::string& path, const std::string& json_body) {
  return api_request("POST", path, json_body);
}
Result<std::string> Client::raw_delete(const std::string& path) { return api_request("DELETE", path); }

}  // namespace mooreview
