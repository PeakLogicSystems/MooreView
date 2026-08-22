#include "json_helpers.hpp"

#include <cstdlib>
#include <cstring>

namespace mooreview {
namespace json {

std::string escape(const std::string& s) {
  std::string out;
  out.reserve(s.size() + 8);
  for (char c : s) {
    switch (c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default: out += c; break;
    }
  }
  return out;
}

std::string error_message(const cJSON* root, const std::string& fallback) {
  if (!root) return fallback;
  const cJSON* err = cJSON_GetObjectItemCaseSensitive(root, "error");
  if (cJSON_IsString(err) && err->valuestring) return err->valuestring;
  return fallback;
}

TagType tag_type_from_json(const char* s) {
  if (!s) return TagType::Unknown;
  if (std::strcmp(s, "BOOL") == 0) return TagType::Bool;
  if (std::strcmp(s, "INT") == 0) return TagType::Int;
  if (std::strcmp(s, "REAL") == 0) return TagType::Real;
  if (std::strcmp(s, "TIMER") == 0) return TagType::Timer;
  if (std::strcmp(s, "COUNTER") == 0) return TagType::Counter;
  if (std::strcmp(s, "PID") == 0) return TagType::Pid;
  if (std::strcmp(s, "AVG") == 0) return TagType::Avg;
  return TagType::Unknown;
}

TagRole tag_role_from_json(const char* s) {
  if (!s) return TagRole::Unknown;
  if (std::strcmp(s, "input") == 0) return TagRole::Input;
  if (std::strcmp(s, "output") == 0) return TagRole::Output;
  if (std::strcmp(s, "memory") == 0) return TagRole::Memory;
  if (std::strcmp(s, "fb") == 0) return TagRole::Fb;
  return TagRole::Unknown;
}

TagQuality tag_quality_from_json(const char* s) {
  if (!s) return TagQuality::Unknown;
  if (std::strcmp(s, "GOOD") == 0) return TagQuality::Good;
  if (std::strcmp(s, "BAD") == 0) return TagQuality::Bad;
  if (std::strcmp(s, "STALE") == 0) return TagQuality::Stale;
  return TagQuality::Unknown;
}

Tag parse_tag(const cJSON* item) {
  Tag t;
  if (!item) return t;
  char* printed = cJSON_PrintUnformatted(const_cast<cJSON*>(item));
  if (printed) {
    t.raw_json = printed;
    cJSON_free(printed);
  }
  const cJSON* id = cJSON_GetObjectItemCaseSensitive(item, "id");
  if (cJSON_IsString(id) && id->valuestring) t.id = id->valuestring;
  const cJSON* type = cJSON_GetObjectItemCaseSensitive(item, "type");
  if (cJSON_IsString(type)) t.type = tag_type_from_json(type->valuestring);
  const cJSON* role = cJSON_GetObjectItemCaseSensitive(item, "role");
  if (cJSON_IsString(role)) t.role = tag_role_from_json(role->valuestring);
  const cJSON* driver = cJSON_GetObjectItemCaseSensitive(item, "driverId");
  if (cJSON_IsString(driver) && driver->valuestring) t.driver_id = driver->valuestring;
  const cJSON* qual = cJSON_GetObjectItemCaseSensitive(item, "quality");
  if (cJSON_IsString(qual)) t.quality = tag_quality_from_json(qual->valuestring);
  const cJSON* val = cJSON_GetObjectItemCaseSensitive(item, "value");
  if (cJSON_IsBool(val)) t.value_bool = cJSON_IsTrue(val);
  else if (cJSON_IsNumber(val)) {
    if (t.type == TagType::Real || t.type == TagType::Pid || t.type == TagType::Avg)
      t.value_real = val->valuedouble;
    else
      t.value_int = static_cast<int64_t>(val->valuedouble);
  }
  return t;
}

TagsResponse parse_tags_response(const std::string& body) {
  TagsResponse out;
  cJSON* root = cJSON_Parse(body.c_str());
  if (!root) return out;
  const cJSON* tags = cJSON_GetObjectItemCaseSensitive(root, "tags");
  if (cJSON_IsArray(tags)) {
    const cJSON* item = nullptr;
    cJSON_ArrayForEach(item, tags) {
      out.tags.push_back(parse_tag(item));
    }
  }
  const cJSON* count = cJSON_GetObjectItemCaseSensitive(root, "count");
  if (cJSON_IsNumber(count)) out.count = count->valueint;
  const cJSON* max = cJSON_GetObjectItemCaseSensitive(root, "max");
  if (cJSON_IsNumber(max)) out.max = max->valueint;
  cJSON_Delete(root);
  return out;
}

RuntimeStatus parse_runtime_status(const std::string& body) {
  RuntimeStatus st;
  cJSON* root = cJSON_Parse(body.c_str());
  if (!root) return st;
  const cJSON* running = cJSON_GetObjectItemCaseSensitive(root, "running");
  if (cJSON_IsBool(running)) st.running = cJSON_IsTrue(running);
  const cJSON* scan = cJSON_GetObjectItemCaseSensitive(root, "scanMs");
  if (cJSON_IsNumber(scan)) st.scan_ms = scan->valueint;
  const cJSON* cycle = cJSON_GetObjectItemCaseSensitive(root, "lastCycleMs");
  if (cJSON_IsNumber(cycle)) st.last_cycle_ms = cycle->valueint;
  const cJSON* prog = cJSON_GetObjectItemCaseSensitive(root, "programOk");
  if (cJSON_IsBool(prog)) st.program_ok = cJSON_IsTrue(prog);
  const cJSON* stats = cJSON_GetObjectItemCaseSensitive(root, "stats");
  if (cJSON_IsObject(stats)) {
    const cJSON* cycles = cJSON_GetObjectItemCaseSensitive(stats, "cycles");
    if (cJSON_IsNumber(cycles)) st.cycles = cycles->valueint;
    const cJSON* over = cJSON_GetObjectItemCaseSensitive(stats, "overruns");
    if (cJSON_IsNumber(over)) st.overruns = over->valueint;
  }
  const cJSON* errs = cJSON_GetObjectItemCaseSensitive(root, "errors");
  if (cJSON_IsArray(errs)) st.errors = parse_string_array(errs);
  cJSON_Delete(root);
  return st;
}

ProgramResponse parse_program_response(const std::string& body) {
  ProgramResponse out;
  cJSON* root = cJSON_Parse(body.c_str());
  if (!root) return out;
  const cJSON* src = cJSON_GetObjectItemCaseSensitive(root, "source");
  if (cJSON_IsString(src) && src->valuestring) out.source = src->valuestring;
  const cJSON* active = cJSON_GetObjectItemCaseSensitive(root, "active");
  if (cJSON_IsString(active) && active->valuestring) out.active_path = active->valuestring;
  cJSON_Delete(root);
  return out;
}

ProgramPutResult parse_program_put(const std::string& body) {
  ProgramPutResult out;
  cJSON* root = cJSON_Parse(body.c_str());
  if (!root) return out;
  const cJSON* ok = cJSON_GetObjectItemCaseSensitive(root, "ok");
  if (cJSON_IsBool(ok)) out.ok = cJSON_IsTrue(ok);
  const cJSON* prog = cJSON_GetObjectItemCaseSensitive(root, "programOk");
  if (cJSON_IsBool(prog)) out.program_ok = cJSON_IsTrue(prog);
  const cJSON* errs = cJSON_GetObjectItemCaseSensitive(root, "errors");
  if (cJSON_IsArray(errs)) out.errors = parse_string_array(errs);
  cJSON_Delete(root);
  return out;
}

ProgramValidateResult parse_program_validate(const std::string& body) {
  ProgramValidateResult out;
  cJSON* root = cJSON_Parse(body.c_str());
  if (!root) return out;
  const cJSON* ok = cJSON_GetObjectItemCaseSensitive(root, "ok");
  if (cJSON_IsBool(ok)) out.ok = cJSON_IsTrue(ok);
  const cJSON* errs = cJSON_GetObjectItemCaseSensitive(root, "errors");
  if (cJSON_IsArray(errs)) out.errors = parse_string_array(errs);
  cJSON_Delete(root);
  return out;
}

std::vector<std::string> parse_string_array(const cJSON* arr) {
  std::vector<std::string> out;
  if (!cJSON_IsArray(arr)) return out;
  const cJSON* item = nullptr;
  cJSON_ArrayForEach(item, arr) {
    if (cJSON_IsString(item) && item->valuestring) out.emplace_back(item->valuestring);
  }
  return out;
}

}  // namespace json
}  // namespace mooreview
