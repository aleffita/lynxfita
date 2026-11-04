#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include <memory>
#include <functional>
#include <unordered_map>
#include <variant>

namespace lynxfita {

enum class RuntimeType {
  HermesAOT,
  HermesJIT,
  PrimJS,
  QuickJS,
  V8
};

enum class StatusCode {
  Ok = 0,
  InvalidArgument = 1,
  ModuleNotFound = 2,
  MethodNotFound = 3,
  ExecutionError = 4,
  WasiTrap = 5,
  MemoryOutOfBounds = 6,
  PermissionDenied = 7
};

struct ExecutionResult {
  StatusCode status{StatusCode::Ok};
  std::string result_payload;
  std::string error_message;
  int64_t execution_time_ns{0};

  bool IsSuccess() const { return status == StatusCode::Ok; }
};

using JsiValueVariant = std::variant<
  std::monostate, // undefined/null
  bool,
  int64_t,
  double,
  std::string,
  std::vector<uint8_t> // binary / typed array
>;

class HostObject {
 public:
  virtual ~HostObject() = default;
  virtual std::string GetName() const = 0;
  virtual JsiValueVariant GetProperty(const std::string& name) = 0;
  virtual void SetProperty(const std::string& name, const JsiValueVariant& value) = 0;
  virtual std::vector<std::string> GetPropertyNames() const = 0;
  virtual JsiValueVariant InvokeMethod(const std::string& method_name, const std::vector<JsiValueVariant>& args) = 0;
};

inline std::string JsiValueToString(const JsiValueVariant& val) {
  if (std::holds_alternative<std::string>(val)) {
    return std::get<std::string>(val);
  }
  if (std::holds_alternative<int64_t>(val)) {
    return std::to_string(std::get<int64_t>(val));
  }
  if (std::holds_alternative<double>(val)) {
    return std::to_string(std::get<double>(val));
  }
  if (std::holds_alternative<bool>(val)) {
    return std::get<bool>(val) ? "true" : "false";
  }
  if (std::holds_alternative<std::vector<uint8_t>>(val)) {
    const auto& bytes = std::get<std::vector<uint8_t>>(val);
    return "[BinaryBuffer size=" + std::to_string(bytes.size()) + "]";
  }
  return "";
}

using HostFunction = std::function<JsiValueVariant(const std::vector<JsiValueVariant>& args)>;

} // namespace lynxfita
