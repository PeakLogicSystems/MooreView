#include "mooreview/types.hpp"

#include <cstring>

namespace mooreview {

TagType tag_type_from_string(const std::string& s) {
  if (s == "BOOL") return TagType::Bool;
  if (s == "INT") return TagType::Int;
  if (s == "REAL") return TagType::Real;
  if (s == "TIMER") return TagType::Timer;
  if (s == "COUNTER") return TagType::Counter;
  if (s == "PID") return TagType::Pid;
  if (s == "AVG") return TagType::Avg;
  return TagType::Unknown;
}

TagRole tag_role_from_string(const std::string& s) {
  if (s == "input") return TagRole::Input;
  if (s == "output") return TagRole::Output;
  if (s == "memory") return TagRole::Memory;
  if (s == "fb") return TagRole::Fb;
  return TagRole::Unknown;
}

const char* tag_type_to_string(TagType t) {
  switch (t) {
    case TagType::Bool: return "BOOL";
    case TagType::Int: return "INT";
    case TagType::Real: return "REAL";
    case TagType::Timer: return "TIMER";
    case TagType::Counter: return "COUNTER";
    case TagType::Pid: return "PID";
    case TagType::Avg: return "AVG";
    default: return "UNKNOWN";
  }
}

}  // namespace mooreview
