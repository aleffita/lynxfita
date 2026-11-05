#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif

#include <jsi/jsi.h>
#include <cstdint>
#include <string>
#include <vector>
#include <memory>
#include <functional>
#include <unordered_map>
#include <variant>
#include <stdexcept>
#include <sstream>

namespace lynxfita {

// Re-export facebook::jsi types into lynxfita namespace for ergonomic access
using JsiRuntime = facebook::jsi::Runtime;
using JsiValue = facebook::jsi::Value;
using JsiObject = facebook::jsi::Object;
using JsiString = facebook::jsi::String;
using JsiFunction = facebook::jsi::Function;
using JsiPropNameID = facebook::jsi::PropNameID;
using JsiHostFunctionType = facebook::jsi::HostFunctionType;

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

inline std::string JsiValueToString(const JsiValueVariant& val) {
  if (std::holds_alternative<std::string>(val)) {
    return std::get<std::string>(val);
  }
  if (std::holds_alternative<int64_t>(val)) {
    return std::to_string(std::get<int64_t>(val));
  }
  if (std::holds_alternative<double>(val)) {
    double d = std::get<double>(val);
    if (d == static_cast<int64_t>(d)) {
      return std::to_string(static_cast<int64_t>(d));
    }
    std::ostringstream ss;
    ss << d;
    return ss.str();
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

inline facebook::jsi::Value VariantToJsiValue(facebook::jsi::Runtime& rt, const JsiValueVariant& val) {
  if (std::holds_alternative<std::monostate>(val)) {
    return facebook::jsi::Value::undefined();
  }
  if (std::holds_alternative<bool>(val)) {
    return facebook::jsi::Value(std::get<bool>(val));
  }
  if (std::holds_alternative<int64_t>(val)) {
    return facebook::jsi::Value(static_cast<double>(std::get<int64_t>(val)));
  }
  if (std::holds_alternative<double>(val)) {
    return facebook::jsi::Value(std::get<double>(val));
  }
  if (std::holds_alternative<std::string>(val)) {
    return facebook::jsi::String::createFromUtf8(rt, std::get<std::string>(val));
  }
  if (std::holds_alternative<std::vector<uint8_t>>(val)) {
    const auto& bytes = std::get<std::vector<uint8_t>>(val);
    auto str = std::string(reinterpret_cast<const char*>(bytes.data()), bytes.size());
    return facebook::jsi::String::createFromUtf8(rt, str);
  }
  return facebook::jsi::Value::undefined();
}

inline JsiValueVariant JsiValueToVariant(facebook::jsi::Runtime& rt, const facebook::jsi::Value& val) {
  if (val.isUndefined() || val.isNull()) {
    return std::monostate{};
  }
  if (val.isBool()) {
    return val.getBool();
  }
  if (val.isNumber()) {
    return val.getNumber();
  }
  if (val.isString()) {
    return val.getString(rt).utf8(rt);
  }
  if (val.isObject()) {
    auto obj = val.getObject(rt);
    if (obj.isArrayBuffer(rt)) {
      auto buf = obj.getArrayBuffer(rt);
      std::vector<uint8_t> data(buf.data(rt), buf.data(rt) + buf.size(rt));
      return data;
    }
    return val.toString(rt).utf8(rt);
  }
  return std::monostate{};
}

using HostFunction = std::function<JsiValueVariant(const std::vector<JsiValueVariant>& args)>;

/**
 * Authentic JSI HostObject adhering to facebook::jsi::HostObject.
 * Bridges property access and method calls to the Hermes runtime.
 */
class HostObject : public facebook::jsi::HostObject {
 public:
  ~HostObject() override = default;

  virtual std::string GetName() const = 0;

  // facebook::jsi::HostObject virtual overrides
  facebook::jsi::Value get(facebook::jsi::Runtime& rt, const facebook::jsi::PropNameID& name) override {
    std::string prop = name.utf8(rt);
    if (prop == "name") {
      return facebook::jsi::String::createFromUtf8(rt, GetName());
    }

    auto propVal = GetProperty(prop);
    if (!std::holds_alternative<std::monostate>(propVal)) {
      return VariantToJsiValue(rt, propVal);
    }

    // Return invokable host function for method dispatch
    auto method_name = prop;
    return facebook::jsi::Function::createFromHostFunction(
        rt,
        name,
        0,
        [this, method_name](facebook::jsi::Runtime& rt,
                            const facebook::jsi::Value& /*thisVal*/,
                            const facebook::jsi::Value* args,
                            size_t count) -> facebook::jsi::Value {
          std::vector<JsiValueVariant> variant_args;
          variant_args.reserve(count);
          for (size_t i = 0; i < count; ++i) {
            variant_args.push_back(JsiValueToVariant(rt, args[i]));
          }
          auto result = this->InvokeMethod(method_name, variant_args);
          return VariantToJsiValue(rt, result);
        });
  }

  void set(facebook::jsi::Runtime& rt, const facebook::jsi::PropNameID& name, const facebook::jsi::Value& value) override {
    SetProperty(name.utf8(rt), JsiValueToVariant(rt, value));
  }

  std::vector<facebook::jsi::PropNameID> getPropertyNames(facebook::jsi::Runtime& rt) override {
    std::vector<facebook::jsi::PropNameID> result;
    result.push_back(facebook::jsi::PropNameID::forAscii(rt, "name"));
    for (const auto& prop : GetPropertyNames()) {
      result.push_back(facebook::jsi::PropNameID::forUtf8(rt, prop));
    }
    return result;
  }

  // Pure virtual / customizable methods
  virtual std::vector<std::string> GetPropertyNames() const { return {}; }
  virtual JsiValueVariant GetProperty(const std::string& /*name*/) { return std::monostate{}; }
  virtual void SetProperty(const std::string& /*name*/, const JsiValueVariant& /*value*/) {}
  virtual JsiValueVariant InvokeMethod(const std::string& /*method_name*/, const std::vector<JsiValueVariant>& /*args*/) {
    return std::monostate{};
  }
};

} // namespace lynxfita
