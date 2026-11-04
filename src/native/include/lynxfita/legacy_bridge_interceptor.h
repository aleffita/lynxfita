#pragma once

#include "jsi_types.h"
#include <string>
#include <unordered_map>
#include <functional>
#include <chrono>
#include <atomic>
#include <mutex>
#include <shared_mutex>

namespace lynxfita {

using DirectNativeHandler = std::function<JsiValueVariant(const std::vector<JsiValueVariant>& params)>;

class LegacyBridgeInterceptor : public HostObject {
 public:
  LegacyBridgeInterceptor();
  ~LegacyBridgeInterceptor() override;

  std::string GetName() const override { return "spkPipe"; }
  JsiValueVariant GetProperty(const std::string& name) override;
  void SetProperty(const std::string& name, const JsiValueVariant& value) override;
  std::vector<std::string> GetPropertyNames() const override;
  JsiValueVariant InvokeMethod(const std::string& method_name, const std::vector<JsiValueVariant>& args) override;

  bool RegisterNativeMethod(const std::string& module_name,
                            const std::string& method_name,
                            DirectNativeHandler handler);

  bool HasRegisteredMethod(const std::string& module_name, const std::string& method_name) const;

  // Interception fast-path for legacy JSON string bridge fallback vs direct JSI
  ExecutionResult DispatchLegacyJson(const std::string& module_name,
                                     const std::string& method_name,
                                     const std::string& json_payload);

  ExecutionResult DispatchDirectJsi(const std::string& module_name,
                                    const std::string& method_name,
                                    const std::vector<JsiValueVariant>& params);

  // High-performance binary Protobuf bridge dispatch
  ExecutionResult DispatchProtobuf(const uint8_t* protobuf_data, size_t length);

  uint64_t GetDirectJsiDispatches() const { return direct_jsi_dispatches_.load(); }
  uint64_t GetLegacyJsonDispatches() const { return legacy_json_dispatches_.load(); }
  uint64_t GetProtobufDispatches() const { return protobuf_dispatches_.load(); }
  double GetBypassRatio() const;

 private:
  std::string BuildKey(const std::string& module, const std::string& method) const {
    return module + "::" + method;
  }

  mutable std::shared_mutex mutex_;
  std::unordered_map<std::string, DirectNativeHandler> registered_methods_;
  std::atomic<uint64_t> direct_jsi_dispatches_{0};
  std::atomic<uint64_t> legacy_json_dispatches_{0};
  std::atomic<uint64_t> protobuf_dispatches_{0};
};

} // namespace lynxfita
