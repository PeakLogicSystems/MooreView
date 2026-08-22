#pragma once

#include <string>

namespace mooreview {

struct Error {
  int http_status = 0;
  std::string message;

  explicit Error(std::string msg, int status = 0)
      : http_status(status), message(std::move(msg)) {}

  static Error http(int status, const std::string& msg) {
    return Error(msg, status);
  }
};

template <typename T>
struct Result {
  bool ok = false;
  T value{};
  Error error{""};

  static Result success(T v) {
    Result r;
    r.ok = true;
    r.value = std::move(v);
    return r;
  }

  static Result failure(Error e) {
    Result r;
    r.ok = false;
    r.error = std::move(e);
    return r;
  }
};

template <>
struct Result<void> {
  bool ok = false;
  Error error{""};

  static Result success() {
    Result r;
    r.ok = true;
    return r;
  }

  static Result failure(Error e) {
    Result r;
    r.ok = false;
    r.error = std::move(e);
    return r;
  }
};

}  // namespace mooreview
