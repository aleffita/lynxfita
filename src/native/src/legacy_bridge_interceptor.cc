#include "lynxfita/legacy_bridge_interceptor.h"
#include <stdexcept>
#include <chrono>

namespace lynxfita {

LegacyBridgeInterceptor::LegacyBridgeInterceptor() = default;
LegacyBridgeInterceptor::~LegacyBridgeInterceptor() = default;

JsiValueVariant LegacyBridgeInterceptor::GetProperty(const std::string& name) {
  if (name == "name") {
    return std::string("spkPipe");
  }
  return std::monostate{};
}

void LegacyBridgeInterceptor::SetProperty(const std::string& /*name*/, const JsiValueVariant& /*value*/) {
  // Read-only bridge interface
}

std::vector<std::string> LegacyBridgeInterceptor::GetPropertyNames() const {
  return {"call", "on", "off", "hasMethod"};
}

JsiValueVariant LegacyBridgeInterceptor::InvokeMethod(const std::string& method_name,
                                                      const std::vector<JsiValueVariant>& args) {
  if (method_name == "call") {
    if (args.size() < 2) {
      throw std::runtime_error("spkPipe.call requires at least module and method arguments");
    }

    std::string mod;
    std::string method;

    if (std::holds_alternative<std::string>(args[0])) {
      mod = std::get<std::string>(args[0]);
    }
    if (std::holds_alternative<std::string>(args[1])) {
      method = std::get<std::string>(args[1]);
    }

    std::vector<JsiValueVariant> params;
    for (size_t i = 2; i < args.size(); ++i) {
      params.push_back(args[i]);
    }

    auto res = DispatchDirectJsi(mod, method, params);
    if (!res.IsSuccess()) {
      throw std::runtime_error(res.error_message);
    }
    return res.result_payload;
  }

  if (method_name == "hasMethod") {
    if (args.size() >= 2 &&
        std::holds_alternative<std::string>(args[0]) &&
        std::holds_alternative<std::string>(args[1])) {
      return HasRegisteredMethod(std::get<std::string>(args[0]), std::get<std::string>(args[1]));
    }
    return false;
  }

  throw std::runtime_error("Unknown spkPipe method: " + method_name);
}

bool LegacyBridgeInterceptor::RegisterNativeMethod(const std::string& module_name,
                                                   const std::string& method_name,
                                                   DirectNativeHandler handler) {
  if (module_name.empty() || method_name.empty() || !handler) {
    return false;
  }
  registered_methods_[BuildKey(module_name, method_name)] = std::move(handler);
  return true;
}

bool LegacyBridgeInterceptor::HasRegisteredMethod(const std::string& module_name,
                                                  const std::string& method_name) const {
  return registered_methods_.find(BuildKey(module_name, method_name)) != registered_methods_.end();
}

ExecutionResult LegacyBridgeInterceptor::DispatchDirectJsi(const std::string& module_name,
                                                          const std::string& method_name,
                                                          const std::vector<JsiValueVariant>& params) {
  ExecutionResult res;
  const auto start = std::chrono::steady_clock::now();

  auto it = registered_methods_.find(BuildKey(module_name, method_name));
  if (it == registered_methods_.end()) {
    res.status = StatusCode::MethodNotFound;
    res.error_message = "Method not registered in Direct JSI registry: " + module_name + "." + method_name;
    return res;
  }

  try {
    auto ret = it->second(params);
    direct_jsi_dispatches_.fetch_add(1, std::memory_order_relaxed);
    res.status = StatusCode::Ok;
    if (std::holds_alternative<std::string>(ret)) {
      res.result_payload = std::get<std::string>(ret);
    } else if (std::holds_alternative<int64_t>(ret)) {
      res.result_payload = std::to_string(std::get<int64_t>(ret));
    } else if (std::holds_alternative<bool>(ret)) {
      res.result_payload = std::get<bool>(ret) ? "true" : "false";
    }
  } catch (const std::exception& e) {
    res.status = StatusCode::ExecutionError;
    res.error_message = e.what();
  }

  const auto finish = std::chrono::steady_clock::now();
  res.execution_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(finish - start).count();
  return res;
}

ExecutionResult LegacyBridgeInterceptor::DispatchLegacyJson(const std::string& module_name,
                                                           const std::string& method_name,
                                                           const std::string& json_payload) {
  ExecutionResult res;
  const auto start = std::chrono::steady_clock::now();
  legacy_json_dispatches_.fetch_add(1, std::memory_order_relaxed);

  // Fallback serialization path
  std::vector<JsiValueVariant> params = { json_payload };
  auto it = registered_methods_.find(BuildKey(module_name, method_name));
  if (it == registered_methods_.end()) {
    res.status = StatusCode::MethodNotFound;
    res.error_message = "Method not found in legacy JSON bridge";
    return res;
  }

  try {
    auto ret = it->second(params);
    res.status = StatusCode::Ok;
    res.result_payload = std::holds_alternative<std::string>(ret) ? std::get<std::string>(ret) : "ok";
  } catch (const std::exception& e) {
    res.status = StatusCode::ExecutionError;
    res.error_message = e.what();
  }

  const auto finish = std::chrono::steady_clock::now();
  res.execution_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(finish - start).count();
  return res;
}

double LegacyBridgeInterceptor::GetBypassRatio() const {
  uint64_t direct = direct_jsi_dispatches_.load(std::memory_order_relaxed);
  uint64_t legacy = legacy_json_dispatches_.load(std::memory_order_relaxed);
  uint64_t total = direct + legacy;
  if (total == 0) return 0.0;
  return static_cast<double>(direct) / static_cast<double>(total);
}

} // namespace lynxfita
