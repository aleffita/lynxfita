#pragma once

#include "lynxfita/jsi_types.h"
#include "lynxfita/cordis_native_context.h"
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <string>
#include <memory>
#include <unordered_map>
#include <vector>
#include <chrono>

namespace lynxfita {

class DmaEibEngine;

class HermesRuntimeAdapter : public cordis::NativeService {
 public:
  HermesRuntimeAdapter();
  ~HermesRuntimeAdapter() override;

  bool Initialize(bool enable_inspector = false);
  void Teardown();
  bool IsInitialized() const { return initialized_; }

  facebook::hermes::HermesRuntime* GetHermesRuntime() const { return runtime_.get(); }
  facebook::jsi::Runtime& GetJsiRuntime();

  void AttachDmaEngine(std::shared_ptr<DmaEibEngine> dma);
  std::shared_ptr<DmaEibEngine> GetDmaEngine() const { return dma_engine_; }

  bool RegisterHostObject(const std::string& name, std::shared_ptr<HostObject> host_object);
  std::shared_ptr<HostObject> GetHostObject(const std::string& name) const;

  bool RegisterHostFunction(const std::string& name, HostFunction func);
  HostFunction GetHostFunction(const std::string& name) const;

  ExecutionResult EvaluateBytecode(const uint8_t* bytecode,
                                  size_t length,
                                  const std::string& source_url,
                                  const std::vector<JsiValueVariant>& args = {});

  ExecutionResult EvaluateSource(const std::string& source_code,
                                const std::string& source_url,
                                const std::vector<JsiValueVariant>& args = {});

  ExecutionResult CallHostMethod(const std::string& object_name,
                                const std::string& method_name,
                                const std::vector<JsiValueVariant>& args);

  RuntimeType GetRuntimeType() const { return RuntimeType::HermesAOT; }
  std::string GetRuntimeVersion() const;

 private:
  bool initialized_{false};
  std::shared_ptr<DmaEibEngine> dma_engine_{nullptr};
  std::unique_ptr<facebook::hermes::HermesRuntime> runtime_{nullptr};
  std::unordered_map<std::string, std::shared_ptr<HostObject>> host_objects_;
  std::unordered_map<std::string, HostFunction> host_functions_;
};

} // namespace lynxfita
