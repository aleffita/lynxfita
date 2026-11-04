#include "lynxfita/wasi_host_module.h"
#include <stdexcept>
#include <chrono>
#include <cstring>
#include <cstdint>
#include <cmath>

namespace lynxfita {

WasiHostModule::WasiHostModule(const std::string& module_name, WasiCapabilities caps)
    : module_name_(module_name), capabilities_(caps) {
  linear_memory_.resize(64 * 1024, 0); // Initial 1 page (64KB) memory
}

WasiHostModule::~WasiHostModule() = default;

JsiValueVariant WasiHostModule::GetProperty(const std::string& name) {
  if (name == "moduleName") {
    return module_name_;
  }
  if (name == "memorySize") {
    return static_cast<int64_t>(linear_memory_.size());
  }
  return std::monostate{};
}

void WasiHostModule::SetProperty(const std::string& /*name*/, const JsiValueVariant& /*value*/) {
  // Read-only host module properties
}

std::vector<std::string> WasiHostModule::GetPropertyNames() const {
  std::vector<std::string> names = {"moduleName", "memorySize", "execute"};
  for (const auto& [name, _] : exports_) {
    names.push_back(name);
  }
  return names;
}

JsiValueVariant WasiHostModule::InvokeMethod(const std::string& method_name,
                                            const std::vector<JsiValueVariant>& args) {
  if (method_name == "execute") {
    if (args.empty() || !std::holds_alternative<std::string>(args[0])) {
      throw std::runtime_error("execute requires function name string as first parameter");
    }
    std::string entry = std::get<std::string>(args[0]);
    std::vector<JsiValueVariant> forward_args;
    for (size_t i = 1; i < args.size(); ++i) {
      forward_args.push_back(args[i]);
    }
    auto res = Execute(entry, forward_args);
    if (!res.IsSuccess()) {
      throw std::runtime_error(res.error_message);
    }
    return res.result_payload;
  }

  auto it = exports_.find(method_name);
  if (it != exports_.end()) {
    return it->second(args);
  }

  throw std::runtime_error("WASI method not found: " + method_name);
}

bool WasiHostModule::LoadWasmBinary(const uint8_t* wasm_bytes, size_t length) {
  if (!wasm_bytes || length < 8) {
    return false;
  }
  // WASM magic header: \0asm (0x00, 0x61, 0x73, 0x6d)
  if (wasm_bytes[0] != 0x00 || wasm_bytes[1] != 0x61 || wasm_bytes[2] != 0x73 || wasm_bytes[3] != 0x6d) {
    return false;
  }
  is_instantiated_ = true;
  return true;
}

bool WasiHostModule::RegisterExport(const std::string& export_name,
                                   std::function<JsiValueVariant(const std::vector<JsiValueVariant>&)> handler) {
  if (export_name.empty() || !handler) {
    return false;
  }
  exports_[export_name] = std::move(handler);
  return true;
}

ExecutionResult WasiHostModule::Execute(const std::string& entrypoint, const std::vector<JsiValueVariant>& args) {
  ExecutionResult res;
  const auto start = std::chrono::steady_clock::now();

  auto it = exports_.find(entrypoint);
  if (it == exports_.end()) {
    res.status = StatusCode::MethodNotFound;
    res.error_message = "Entrypoint not exported by WASI module: " + entrypoint;
    return res;
  }

  try {
    auto val = it->second(args);
    res.status = StatusCode::Ok;
    res.result_payload = JsiValueToString(val);
  } catch (const std::exception& e) {
    res.status = StatusCode::WasiTrap;
    res.error_message = std::string("WASI trap execution fault: ") + e.what();
  }

  const auto finish = std::chrono::steady_clock::now();
  res.execution_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(finish - start).count();
  return res;
}

bool WasiHostModule::WriteMemory(size_t offset, const uint8_t* data, size_t length) {
  if (!data || length == 0) {
    return true;
  }
  if (offset > capabilities_.memory_limit_bytes || length > capabilities_.memory_limit_bytes - offset) {
    return false; // Exceeds sandbox capability ceiling
  }
  if (offset > linear_memory_.size() || length > linear_memory_.size() - offset) {
    linear_memory_.resize(offset + length, 0);
  }
  std::memcpy(linear_memory_.data() + offset, data, length);
  return true;
}

bool WasiHostModule::ReadMemory(size_t offset, size_t length, std::vector<uint8_t>& out_bytes) const {
  if (offset > linear_memory_.size() || length > linear_memory_.size() - offset) {
    return false; // Out of bounds
  }
  out_bytes.resize(length);
  std::memcpy(out_bytes.data(), linear_memory_.data() + offset, length);
  return true;
}

bool WasiHostModule::GrowMemory(size_t additional_bytes) {
  if (additional_bytes > capabilities_.memory_limit_bytes - linear_memory_.size()) {
    return false;
  }
  linear_memory_.resize(linear_memory_.size() + additional_bytes, 0);
  return true;
}

} // namespace lynxfita
