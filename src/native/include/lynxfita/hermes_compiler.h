#pragma once

#include "lynxfita/jsi_types.h"
#include "lynxfita/cordis_native_context.h"
#include <vector>
#include <string>
#include <memory>
#include <cstdint>

namespace lynxfita {

class HermesRuntimeAdapter;

enum class HermesCompilerMode : uint8_t {
  AOT = 0x01,
  StaticTyped = 0x02,
  StaticJitHybrid = 0x04
};

struct CompilationOptions {
  bool optimize_aot{true};
  bool static_h_mode{true};
  bool hybrid_jit{false};
  bool generate_debug_symbols{false};
  uint32_t bytecode_version{0};
};

struct CompilationResult {
  bool success{false};
  std::vector<uint8_t> bytecode;
  uint64_t source_fnv_hash{0};
  std::vector<std::string> symbols_table;
  std::string error_message;
  uint64_t compilation_time_ns{0};
};

class HermesRuntimeCompiler : public cordis::NativeService {
 public:
  HermesRuntimeCompiler();
  ~HermesRuntimeCompiler() override = default;

  // Compile JavaScript source code into authentic Hermes Bytecode (.hbc) using hermes::compileJS
  CompilationResult CompileSource(const std::string& source_code,
                                  const std::string& source_url,
                                  const CompilationOptions& options = CompilationOptions{});

  // Verify whether a buffer is valid Hermes bytecode using IHermesRootAPI::isHermesBytecode
  static bool ValidateBytecode(const uint8_t* bytecode_data, size_t length);

  // Extract 64-bit hash from bytecode payload
  static uint64_t ExtractBytecodeHash(const uint8_t* bytecode_data, size_t length);
  static uint64_t ExtractSourceHash(const uint8_t* bytecode_data, size_t length) {
    return ExtractBytecodeHash(bytecode_data, length);
  }

  // Attach active runtime adapter for hot-reload re-evaluation
  void AttachRuntimeAdapter(std::shared_ptr<HermesRuntimeAdapter> adapter);

  // Hot reload a bytecode bundle into an active runtime
  bool HotReloadBundle(const std::string& bundle_name, const uint8_t* bytecode_data, size_t length);

  size_t GetLoadedBundleCount() const { return loaded_bundles_.size(); }

 private:
  std::vector<std::string> loaded_bundles_;
  std::shared_ptr<HermesRuntimeAdapter> adapter_{nullptr};
};

// JSI HostObject exposing the compiler directly to JavaScript
class HermesCompilerHostObject : public HostObject {
 public:
  explicit HermesCompilerHostObject(std::shared_ptr<HermesRuntimeCompiler> compiler)
      : compiler_(std::move(compiler)) {}

  std::string GetName() const override { return "HermesCompiler"; }

  std::vector<std::string> GetPropertyNames() const override {
    return {"loadedBundleCount", "compile"};
  }

  JsiValueVariant GetProperty(const std::string& name) override {
    if (name == "loadedBundleCount") {
      return static_cast<int64_t>(compiler_ ? compiler_->GetLoadedBundleCount() : 0);
    }
    return std::monostate{};
  }

  JsiValueVariant InvokeMethod(const std::string& method_name, const std::vector<JsiValueVariant>& args) override {
    if (method_name == "compile" && !args.empty()) {
      std::string code = JsiValueToString(args[0]);
      if (compiler_) {
        auto res = compiler_->CompileSource(code, "dynamic.js");
        if (res.success) {
          return "Compiled HBC (" + std::to_string(res.bytecode.size()) + " bytes)";
        }
        return "Compilation failed: " + res.error_message;
      }
    }
    return std::monostate{};
  }

 private:
  std::shared_ptr<HermesRuntimeCompiler> compiler_;
};

} // namespace lynxfita
