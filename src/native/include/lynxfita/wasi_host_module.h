#pragma once

#include "jsi_types.h"
#include <string>
#include <vector>
#include <memory>
#include <unordered_map>
#include <functional>
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

// Represents a compiled/decoded Wasm function
struct WasmFunction {
  uint32_t type_index{0};
  std::vector<uint8_t> local_types;
  std::vector<uint8_t> code_bytes;
};

// WebAssembly ValType
enum class WasmValType : uint8_t {
  I32 = 0x7F,
  I64 = 0x7E,
  F32 = 0x7D,
  F64 = 0x7C
};

class WasiHostModule : public HostObject {
 public:
  explicit WasiHostModule(const std::string& module_name, WasiCapabilities caps = {});
  ~WasiHostModule() override;

  std::string GetName() const override { return module_name_; }
  JsiValueVariant GetProperty(const std::string& name) override;
  void SetProperty(const std::string& name, const JsiValueVariant& value) override;
  std::vector<std::string> GetPropertyNames() const override;
  JsiValueVariant InvokeMethod(const std::string& method_name, const std::vector<JsiValueVariant>& args) override;

  // Real WebAssembly Binary parser decoding LEB128 sections (1, 3, 5, 7, 10)
  bool LoadWasmBinary(const uint8_t* wasm_bytes, size_t length);

  // Bind linear memory directly to Stationary DMA
  void BindDmaMemory(uint8_t* dma_buffer, size_t capacity);

  bool RegisterExport(const std::string& export_name,
                      std::function<JsiValueVariant(const std::vector<JsiValueVariant>&)> handler);

  ExecutionResult Execute(const std::string& entrypoint, const std::vector<JsiValueVariant>& args);

  bool WriteMemory(size_t offset, const uint8_t* data, size_t length);
  bool ReadMemory(size_t offset, size_t length, std::vector<uint8_t>& out_bytes) const;
  bool GrowMemory(size_t additional_bytes);

  size_t GetMemoryUsage() const;
  const WasiCapabilities& GetCapabilities() const { return capabilities_; }
  bool IsInstantiated() const { return is_instantiated_; }

  // Execute internal parsed Wasm function by function index
  JsiValueVariant ExecuteWasmFunction(uint32_t func_index, const std::vector<JsiValueVariant>& args);

 private:
  std::string module_name_;
  WasiCapabilities capabilities_;
  std::vector<uint8_t> linear_memory_;
  uint8_t* dma_bound_memory_{nullptr};
  size_t dma_bound_capacity_{0};

  std::unordered_map<std::string, std::function<JsiValueVariant(const std::vector<JsiValueVariant>&)>> exports_;
  std::unordered_map<std::string, uint32_t> wasm_exported_functions_;
  std::vector<WasmFunction> wasm_functions_;
  bool is_instantiated_{false};

  uint8_t* GetMemoryData();
  const uint8_t* GetMemoryData() const;
  size_t GetMemoryCapacity() const;
};

} // namespace lynxfita
