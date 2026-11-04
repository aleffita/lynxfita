#pragma once

#include "jsi_types.h"
#include <string>
#include <vector>
#include <memory>
#include <unordered_map>
#include <cstdint>

namespace lynxfita {

struct WasiCapabilities {
  bool allow_stdout{true};
  bool allow_stderr{true};
  bool allow_env_access{false};
  bool allow_filesystem{false};
  std::vector<std::string> allowed_preopened_dirs;
  size_t memory_limit_bytes{64 * 1024 * 1024}; // 64 MB sandbox limit
};

class WasiHostModule : public HostObject {
 public:
  WasiHostModule(const std::string& module_name, WasiCapabilities caps = {});
  ~WasiHostModule() override;

  std::string GetName() const override { return module_name_; }
  JsiValueVariant GetProperty(const std::string& name) override;
  void SetProperty(const std::string& name, const JsiValueVariant& value) override;
  std::vector<std::string> GetPropertyNames() const override;
  JsiValueVariant InvokeMethod(const std::string& method_name, const std::vector<JsiValueVariant>& args) override;

  bool LoadWasmBinary(const uint8_t* wasm_bytes, size_t length);
  bool RegisterExport(const std::string& export_name,
                      std::function<JsiValueVariant(const std::vector<JsiValueVariant>&)> handler);

  ExecutionResult Execute(const std::string& entrypoint, const std::vector<JsiValueVariant>& args);

  bool WriteMemory(size_t offset, const uint8_t* data, size_t length);
  bool ReadMemory(size_t offset, size_t length, std::vector<uint8_t>& out_bytes) const;
  bool GrowMemory(size_t additional_bytes);

  size_t GetMemoryUsage() const { return linear_memory_.size(); }
  const WasiCapabilities& GetCapabilities() const { return capabilities_; }

 private:
  std::string module_name_;
  WasiCapabilities capabilities_;
  std::vector<uint8_t> linear_memory_;
  std::unordered_map<std::string, std::function<JsiValueVariant(const std::vector<JsiValueVariant>&)>> exports_;
  bool is_instantiated_{false};
};

} // namespace lynxfita
