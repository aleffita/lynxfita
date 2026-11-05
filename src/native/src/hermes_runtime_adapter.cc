#include "lynxfita/hermes_runtime_adapter.h"
#include "lynxfita/dma_eib_engine.h"
#include <iostream>
#include <chrono>
#include <vector>
#include <cstring>
#include <cstdint>

namespace lynxfita {

HermesRuntimeAdapter::HermesRuntimeAdapter()
    : cordis::NativeService("hermes_runtime", {"dma"}) {}

HermesRuntimeAdapter::~HermesRuntimeAdapter() {
  Teardown();
}

bool HermesRuntimeAdapter::Initialize(bool /*enable_inspector*/) {
  if (initialized_ && runtime_) {
    return true;
  }

  try {
    ::hermes::vm::RuntimeConfig config;
    runtime_ = facebook::hermes::makeHermesRuntime(config);
    if (!runtime_) {
      return false;
    }
    initialized_ = true;
    return true;
  } catch (const std::exception& e) {
    std::cerr << "[HermesRuntimeAdapter] Failed to initialize Hermes: " << e.what() << std::endl;
    return false;
  }
}

void HermesRuntimeAdapter::Teardown() {
  if (!initialized_) {
    return;
  }
  host_objects_.clear();
  host_functions_.clear();
  dma_engine_ = nullptr;
  runtime_.reset();
  initialized_ = false;
}

facebook::jsi::Runtime& HermesRuntimeAdapter::GetJsiRuntime() {
  if (!runtime_) {
    throw std::runtime_error("HermesRuntimeAdapter is not initialized");
  }
  return *runtime_;
}

void HermesRuntimeAdapter::AttachDmaEngine(std::shared_ptr<DmaEibEngine> dma) {
  dma_engine_ = std::move(dma);
}

bool HermesRuntimeAdapter::RegisterHostObject(const std::string& name, std::shared_ptr<HostObject> host_object) {
  if (!initialized_ || !runtime_ || !host_object || name.empty()) {
    return false;
  }
  host_objects_[name] = host_object;

  try {
    auto jsi_obj = facebook::jsi::Object::createFromHostObject(*runtime_, host_object);
    runtime_->global().setProperty(*runtime_, name.c_str(), jsi_obj);
    return true;
  } catch (const std::exception& e) {
    std::cerr << "[HermesRuntimeAdapter] RegisterHostObject error: " << e.what() << std::endl;
    return false;
  }
}

std::shared_ptr<HostObject> HermesRuntimeAdapter::GetHostObject(const std::string& name) const {
  auto it = host_objects_.find(name);
  if (it != host_objects_.end()) {
    return it->second;
  }
  return nullptr;
}

bool HermesRuntimeAdapter::RegisterHostFunction(const std::string& name, HostFunction func) {
  if (!initialized_ || !runtime_ || !func || name.empty()) {
    return false;
  }
  host_functions_[name] = func;

  try {
    auto prop = facebook::jsi::PropNameID::forAscii(*runtime_, name);
    auto fn = facebook::jsi::Function::createFromHostFunction(
        *runtime_,
        prop,
        0,
        [func](facebook::jsi::Runtime& rt,
               const facebook::jsi::Value& /*thisVal*/,
               const facebook::jsi::Value* args,
               size_t count) -> facebook::jsi::Value {
          std::vector<JsiValueVariant> vargs;
          vargs.reserve(count);
          for (size_t i = 0; i < count; ++i) {
            vargs.push_back(JsiValueToVariant(rt, args[i]));
          }
          auto res = func(vargs);
          return VariantToJsiValue(rt, res);
        });
    runtime_->global().setProperty(*runtime_, name.c_str(), fn);
    return true;
  } catch (const std::exception& e) {
    std::cerr << "[HermesRuntimeAdapter] RegisterHostFunction error: " << e.what() << std::endl;
    return false;
  }
}

HostFunction HermesRuntimeAdapter::GetHostFunction(const std::string& name) const {
  auto it = host_functions_.find(name);
  if (it != host_functions_.end()) {
    return it->second;
  }
  return nullptr;
}

ExecutionResult HermesRuntimeAdapter::EvaluateBytecode(
    const uint8_t* bytecode,
    size_t length,
    const std::string& source_url,
    const std::vector<JsiValueVariant>& /*args*/) {
  ExecutionResult res;
  if (!initialized_ || !runtime_) {
    res.status = StatusCode::ExecutionError;
    res.error_message = "Runtime not initialized";
    return res;
  }

  if (!bytecode || length == 0) {
    res.status = StatusCode::InvalidArgument;
    res.error_message = "Empty bytecode buffer";
    return res;
  }

  const auto start = std::chrono::steady_clock::now();

  try {
    std::string bc_str(reinterpret_cast<const char*>(bytecode), length);
    auto buf = std::make_shared<facebook::jsi::StringBuffer>(std::move(bc_str));
    auto val = runtime_->evaluateJavaScript(buf, source_url);
    res.status = StatusCode::Ok;
    res.result_payload = JsiValueToString(JsiValueToVariant(*runtime_, val));
  } catch (const facebook::jsi::JSError& err) {
    res.status = StatusCode::ExecutionError;
    res.error_message = err.getMessage();
  } catch (const std::exception& e) {
    res.status = StatusCode::ExecutionError;
    res.error_message = e.what();
  }

  const auto finish = std::chrono::steady_clock::now();
  res.execution_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(finish - start).count();
  return res;
}

ExecutionResult HermesRuntimeAdapter::EvaluateSource(
    const std::string& source_code,
    const std::string& source_url,
    const std::vector<JsiValueVariant>& /*args*/) {
  ExecutionResult res;
  if (!initialized_ || !runtime_) {
    res.status = StatusCode::ExecutionError;
    res.error_message = "Runtime not initialized";
    return res;
  }

  const auto start = std::chrono::steady_clock::now();

  try {
    auto buf = std::make_shared<facebook::jsi::StringBuffer>(source_code);
    auto val = runtime_->evaluateJavaScript(buf, source_url);
    res.status = StatusCode::Ok;
    res.result_payload = JsiValueToString(JsiValueToVariant(*runtime_, val));
  } catch (const facebook::jsi::JSError& err) {
    res.status = StatusCode::ExecutionError;
    res.error_message = err.getMessage();
  } catch (const std::exception& e) {
    res.status = StatusCode::ExecutionError;
    res.error_message = e.what();
  }

  const auto finish = std::chrono::steady_clock::now();
  res.execution_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(finish - start).count();
  return res;
}

ExecutionResult HermesRuntimeAdapter::CallHostMethod(
    const std::string& object_name,
    const std::string& method_name,
    const std::vector<JsiValueVariant>& args) {
  ExecutionResult res;
  auto it = host_objects_.find(object_name);
  if (it == host_objects_.end() || !it->second) {
    res.status = StatusCode::ModuleNotFound;
    res.error_message = "HostObject not found: " + object_name;
    return res;
  }

  const auto start = std::chrono::steady_clock::now();

  try {
    auto ret = it->second->InvokeMethod(method_name, args);
    res.status = StatusCode::Ok;
    res.result_payload = JsiValueToString(ret);
  } catch (const std::invalid_argument& e) {
    res.status = StatusCode::InvalidArgument;
    res.error_message = e.what();
  } catch (const std::exception& e) {
    res.status = StatusCode::ExecutionError;
    res.error_message = e.what();
  }

  const auto finish = std::chrono::steady_clock::now();
  res.execution_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(finish - start).count();
  return res;
}

std::string HermesRuntimeAdapter::GetRuntimeVersion() const {
  auto* root_api = facebook::jsi::castInterface<facebook::hermes::IHermesRootAPI>(facebook::hermes::makeHermesRootAPI());
  uint32_t bc_ver = root_api ? root_api->getBytecodeVersion() : 0;
  return "Meta-Hermes-v" + std::to_string(bc_ver);
}

} // namespace lynxfita
