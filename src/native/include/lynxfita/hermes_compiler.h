#pragma once

#include "lynxfita/jsi_types.h"
#include <vector>
#include <string>
#include <memory>
#include <cstdint>

namespace lynxfita {

struct CompilationOptions {
  bool optimize_aot{true};
  bool static_h_mode{true};
  bool generate_debug_symbols{false};
  uint32_t bytecode_version{96};
};

struct CompilationResult {
  bool success{false};
  std::vector<uint8_t> bytecode;
  std::string error_message;
  uint64_t compilation_time_ns{0};
};

// Hermes Compiler exposed in the runtime environment
class HermesRuntimeCompiler {
 public:
  HermesRuntimeCompiler() = default;
  ~HermesRuntimeCompiler() = default;

  // Compile JavaScript/TypeScript source code into Hermes Bytecode (.hbc)
  CompilationResult CompileSource(const std::string& source_code,
                                  const std::string& source_url,
                                  const CompilationOptions& options = CompilationOptions{});

  // Verify whether a buffer is valid Hermes bytecode
  static bool ValidateBytecode(const uint8_t* bytecode_data, size_t length);

  // Hot reload a bytecode bundle into an active runtime
  bool HotReloadBundle(const std::string& bundle_name, const uint8_t* bytecode_data, size_t length);

  size_t GetLoadedBundleCount() const { return loaded_bundles_.size(); }

 private:
  std::vector<std::string> loaded_bundles_;
};

// JSI HostObject exposing the compiler directly to JavaScript
class HermesCompilerHostObject : public HostObject {
 public:
  explicit HermesCompilerHostObject(std::shared_ptr<HermesRuntimeCompiler> compiler);
  ~HermesCompilerHostObject() override = default;

  std::string GetName() const override { return "HermesCompiler"; }
  JsiValueVariant GetProperty(const std::string& name) override;
  void SetProperty(const std::string& name, const JsiValueVariant& value) override;
  std::vector<std::string> GetPropertyNames() const override;
  JsiValueVariant InvokeMethod(const std::string& name, const std::vector<JsiValueVariant>& args) override;

 private:
  std::shared_ptr<HermesRuntimeCompiler> compiler_;
};

} // namespace lynxfita
