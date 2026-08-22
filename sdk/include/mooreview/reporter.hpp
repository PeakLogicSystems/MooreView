#pragma once

#include <cstdint>
#include <memory>
#include <string>

#include "mooreview/client.hpp"
#include "mooreview/config.hpp"
#include "mooreview/error.hpp"

namespace mooreview {

/** Central HMI acknowledgement after a Parc report. */
struct ReportAck {
  bool ok = false;
  int next_report_sec = 300;
  bool pause_reports = false;
  bool attached = false;
  int report_interval_sec = 300;
};

/**
 * @deprecated Use MQTT Parc bridge in est (settings.mqttParc) instead.
 * Legacy HTTP reporter — read local runtime (:3080), POST snapshots to est-pc.
 */
struct ReporterConfig {
  ClientConfig local_runtime;
  ClientConfig central_hmi;
  std::string device_id;
  std::string device_name;
  std::string platform;
  int report_interval_sec = 300;
  int min_report_interval_sec = 30;
};

class ParcReporter {
 public:
  explicit ParcReporter(ReporterConfig config);
  ParcReporter(ReporterConfig config, std::unique_ptr<Client> local, std::unique_ptr<Client> central);

  const ReporterConfig& config() const { return config_; }

  /** Non-blocking scheduler — call periodically (e.g. once per second). */
  Result<ReportAck> tick(uint64_t now_ms);

  /** Force one report immediately (ignores schedule unless pause_reports). */
  Result<ReportAck> send_now();

  bool pause_reports() const { return pause_reports_; }
  int effective_interval_sec() const;

 private:
  ReporterConfig config_;
  std::unique_ptr<Client> local_;
  std::unique_ptr<Client> central_;
  std::unique_ptr<Client> owned_local_;
  std::unique_ptr<Client> owned_central_;
  uint64_t last_report_ms_ = 0;
  bool pause_reports_ = false;
  int next_report_sec_ = 300;

  Result<ReportAck> post_report(const std::string& json_body);
  std::string build_report_json();
};

}  // namespace mooreview
