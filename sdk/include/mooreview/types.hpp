#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace mooreview {

enum class TagType { Bool, Int, Real, Timer, Counter, Pid, Avg, Unknown };
enum class TagRole { Input, Output, Memory, Fb, Unknown };
enum class TagQuality { Good, Bad, Stale, Unknown };

struct Tag {
  std::string id;
  TagType type = TagType::Unknown;
  TagRole role = TagRole::Unknown;
  std::string driver_id;
  bool value_bool = false;
  int64_t value_int = 0;
  double value_real = 0.0;
  TagQuality quality = TagQuality::Unknown;
  std::string raw_json;
};

struct TagsResponse {
  std::vector<Tag> tags;
  int count = 0;
  int max = 0;
};

struct RuntimeStatus {
  bool running = false;
  int scan_ms = 100;
  int last_cycle_ms = 0;
  int cycles = 0;
  int overruns = 0;
  bool program_ok = false;
  std::vector<std::string> errors;
};

struct ProgramResponse {
  std::string source;
  std::string active_path;
};

struct ProgramPutResult {
  bool ok = false;
  bool program_ok = false;
  std::vector<std::string> errors;
};

struct ProgramValidateResult {
  bool ok = false;
  std::vector<std::string> errors;
};

struct DriverHealth {
  std::string id;
  std::string type;
  bool connected = false;
  std::string message;
};

struct DriversResponse {
  std::string raw_json;
};

struct ForceRequest {
  std::string tag_id;
  bool force_input = false;
  bool force_output = false;
  double force_value = 0.0;
};

TagType tag_type_from_string(const std::string& s);
TagRole tag_role_from_string(const std::string& s);
const char* tag_type_to_string(TagType t);

}  // namespace mooreview
