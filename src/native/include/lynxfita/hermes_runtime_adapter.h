#pragma once

#include "jsi_types.h"
#include <string>
#include <memory>
#include <unordered_map>
#include <chrono>

namespace lynxfita {

class HermesRuntimeAdapter {
 public:
  HermesRuntimeAdapter();
  ~HermesRuntimeAdapter();

  bool Initialize(bool enable_inspector = false);
  void Teardown();

  bool RegisterHostObject(const std::string& name, std::shared_ptr<HostObject> host_object);
  std::shared_ptr<HostObject> GetHostObject(const std::string& name) const;

  bool RegisterHostFunction(const std::string& name, HostFunction func);

  ExecutionResult EvaluateBytecode(const uint8_t* bytecode, size_t length, const std::string& source_url);
  ExecutionResult EvaluateSource(const std::string& source_code, const std::string& source_url);

  ExecutionResult CallHostMethod(const std::string& object_name,
                                const std::string& method_name,
                                const std::vector<JsiValueVariant>& args);

  RuntimeType GetRuntimeType() const { return RuntimeType::HermesAOT; }
  std::string GetRuntimeVersion() const { return "Hermes-0.13.0-StaticH"; }

 private:
  bool initialized_{false};
  std::unordered_map<std::string, std::shared_ptr<HostObject>> host_objects_;
  std::unordered_map<std::string, HostFunction> host_functions_;
};

} // namespace lynxfita
