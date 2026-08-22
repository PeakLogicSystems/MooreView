#include "mooreview/reporter.hpp"

#include <sstream>

extern "C" {
#include "cJSON.h"
}

#include "json_helpers.hpp"

namespace mooreview {

namespace {

uint64_t sec_to_ms(int sec) {
  return static_cast<uint64_t>(sec) * 1000u;
}

ReportAck parse_report_ack(const std::string& body) {
  ReportAck ack;
  cJSON* root = cJSON_Parse(body.c_str());
  if (!root) return ack;
  const cJSON* ok = cJSON_GetObjectItemCaseSensitive(root, "ok");
  if (cJSON_IsBool(ok)) ack.ok = cJSON_IsTrue(ok);
  const cJSON* next = cJSON_GetObjectItemCaseSensitive(root, "nextReportSec");
  if (cJSON_IsNumber(next)) ack.next_report_sec = next->valueint;
  const cJSON* pause = cJSON_GetObjectItemCaseSensitive(root, "pauseReports");
  if (cJSON_IsBool(pause)) ack.pause_reports = cJSON_IsTrue(pause);
  const cJSON* attached = cJSON_GetObjectItemCaseSensitive(root, "attached");
  if (cJSON_IsBool(attached)) ack.attached = cJSON_IsTrue(attached);
  const cJSON* interval = cJSON_GetObjectItemCaseSensitive(root, "reportIntervalSec");
  if (cJSON_IsNumber(interval)) ack.report_interval_sec = interval->valueint;
  cJSON_Delete(root);
  return ack;
}

}  // namespace

ParcReporter::ParcReporter(ReporterConfig config)
    : config_(std::move(config)) {
  owned_local_.reset(new Client(config_.local_runtime));
  owned_central_.reset(new Client(config_.central_hmi));
  local_ = owned_local_.get();
  central_ = owned_central_.get();
  next_report_sec_ = config_.report_interval_sec;
}

ParcReporter::ParcReporter(
    ReporterConfig config,
    std::unique_ptr<Client> local,
    std::unique_ptr<Client> central)
    : config_(std::move(config)),
      local_(local.get()),
      central_(central.get()),
      owned_local_(std::move(local)),
      owned_central_(std::move(central)) {
  next_report_sec_ = config_.report_interval_sec;
}

int ParcReporter::effective_interval_sec() const {
  return pause_reports_ ? next_report_sec_ : config_.report_interval_sec;
}

Result<ReportAck> ParcReporter::post_report(const std::string& json_body) {
  auto r = central_->raw_post("/parc/report", json_body);
  if (!r.ok) return Result<ReportAck>::failure(r.error);
  ReportAck ack = parse_report_ack(r.value);
  if (!ack.ok) return Result<ReportAck>::failure(Error("Parc report rejected"));
  pause_reports_ = ack.pause_reports;
  if (ack.next_report_sec > 0) next_report_sec_ = ack.next_report_sec;
  if (ack.report_interval_sec >= config_.min_report_interval_sec)
    config_.report_interval_sec = ack.report_interval_sec;
  return Result<ReportAck>::success(ack);
}

std::string ParcReporter::build_report_json() {
  auto tags_r = local_->get_tags();
  auto rt_r = local_->raw_get("/runtime/status");
  auto drv_r = local_->raw_get("/drivers");

  std::ostringstream body;
  body << "{"
       << "\"deviceId\":\"" << json::escape(config_.device_id) << "\","
       << "\"name\":\"" << json::escape(config_.device_name.empty() ? config_.device_id : config_.device_name) << "\","
       << "\"platform\":\"" << json::escape(config_.platform) << "\","
       << "\"reportIntervalSec\":" << config_.report_interval_sec << ",";

  body << "\"runtime\":";
  if (rt_r.ok && !rt_r.value.empty()) body << rt_r.value;
  else body << "null";

  body << ",\"tags\":";
  if (tags_r.ok) {
    body << "[";
    for (size_t i = 0; i < tags_r.value.tags.size(); ++i) {
      if (i) body << ',';
      if (!tags_r.value.tags[i].raw_json.empty()) body << tags_r.value.tags[i].raw_json;
      else body << "{\"id\":\"" << json::escape(tags_r.value.tags[i].id) << "\"}";
    }
    body << "]";
  } else {
    body << "[]";
  }

  body << ",\"driverHealth\":";
  if (drv_r.ok && !drv_r.value.empty()) {
    cJSON* root = cJSON_Parse(drv_r.value.c_str());
    const cJSON* health = root ? cJSON_GetObjectItemCaseSensitive(root, "health") : nullptr;
    if (cJSON_IsArray(health)) {
      char* printed = cJSON_PrintUnformatted(health);
      body << (printed ? printed : "[]");
      if (printed) cJSON_free(printed);
    } else {
      body << "[]";
    }
    cJSON_Delete(root);
  } else {
    body << "[]";
  }

  body << "}";
  return body.str();
}

Result<ReportAck> ParcReporter::send_now() {
  if (pause_reports_) {
    ReportAck ack;
    ack.ok = true;
    ack.pause_reports = true;
    ack.next_report_sec = next_report_sec_;
    return Result<ReportAck>::success(ack);
  }
  auto r = post_report(build_report_json());
  if (r.ok) last_report_ms_ = 0;
  return r;
}

Result<ReportAck> ParcReporter::tick(uint64_t now_ms) {
  const int interval_sec = effective_interval_sec();
  const uint64_t due_ms = last_report_ms_ == 0 ? 0 : last_report_ms_ + sec_to_ms(interval_sec);
  if (last_report_ms_ != 0 && now_ms < due_ms) {
    ReportAck ack;
    ack.ok = true;
    ack.pause_reports = pause_reports_;
    ack.next_report_sec = interval_sec;
    return Result<ReportAck>::success(ack);
  }

  if (pause_reports_) {
    last_report_ms_ = now_ms;
    ReportAck ack;
    ack.ok = true;
    ack.pause_reports = true;
    ack.next_report_sec = next_report_sec_;
    return Result<ReportAck>::success(ack);
  }

  auto r = post_report(build_report_json());
  if (r.ok) last_report_ms_ = now_ms;
  return r;
}

}  // namespace mooreview
