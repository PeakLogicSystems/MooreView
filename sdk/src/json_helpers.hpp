#pragma once

#include <string>
#include <vector>

extern "C" {
#include "cJSON.h"
}

#include "mooreview/types.hpp"

namespace mooreview {
namespace json {

std::string escape(const std::string& s);
std::string error_message(const cJSON* root, const std::string& fallback);

Tag parse_tag(const cJSON* item);
TagsResponse parse_tags_response(const std::string& body);
RuntimeStatus parse_runtime_status(const std::string& body);
ProgramResponse parse_program_response(const std::string& body);
ProgramPutResult parse_program_put(const std::string& body);
ProgramValidateResult parse_program_validate(const std::string& body);

std::vector<std::string> parse_string_array(const cJSON* arr);

}  // namespace json
}  // namespace mooreview
