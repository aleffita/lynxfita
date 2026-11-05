#include "lynxfita/hermes_compiler.h"
#include "lynxfita/hermes_runtime_adapter.h"
#include <hermes/CompileJS.h>
#include <hermes/hermes.h>
#include <chrono>
#include <cstring>
#include <cstdint>

namespace lynxfita {

static uint64_t ComputeFnv1a64(const std::string& str) {
  uint64_t hash = 14695981039346656037ULL;
  for (char c : str) {
    hash ^= static_cast<uint8_t>(c);
    hash *= 1099511628211ULL;
  }
  return hash;
}

class CompilerDiagnosticHandler : public hermes::DiagnosticHandler {
 public:
  void handle(const Diagnostic &d) override {
    if (d.kind == Error) {
      if (!error_msg.empty()) error_msg += "; ";
      error_msg += "Line " + std::to_string(d.line) + ":" + std::to_string(d.column) + " " + d.message;
    }
  }
  std::string error_msg;
};

HermesRuntimeCompiler::HermesRuntimeCompiler()
    : cordis::NativeService("hermes_compiler", {}) {}

CompilationResult HermesRuntimeCompiler::CompileSource(
    const std::string& source_code,
    const std::string& source_url,
    const CompilationOptions& options) {
  CompilationResult res;
  const auto start = std::chrono::steady_clock::now();

  CompilerDiagnosticHandler diag_handler;
  std::string bytecode_str;

  bool ok = hermes::compileJS(
      source_code,
      source_url,
      bytecode_str,
      options.optimize_aot,
      false, // emitAsyncBreakCheck
      &diag_handler,
      std::nullopt, // sourceMapBuf
      options.generate_debug_symbols);

  if (ok) {
    res.success = true;
    res.bytecode.assign(
        reinterpret_cast<const uint8_t*>(bytecode_str.data()),
        reinterpret_cast<const uint8_t*>(bytecode_str.data()) + bytecode_str.size());
    res.source_fnv_hash = ComputeFnv1a64(source_code);

    auto* root_api = facebook::jsi::castInterface<facebook::hermes::IHermesRootAPI>(facebook::hermes::makeHermesRootAPI());
    uint32_t bc_ver = root_api ? root_api->getBytecodeVersion() : 0;
    res.symbols_table.push_back("Hermes_HBC_v" + std::to_string(bc_ver));
  } else {
    res.success = false;
    res.error_message = diag_handler.error_msg.empty() ? "Hermes compilation failed" : diag_handler.error_msg;
  }

  const auto finish = std::chrono::steady_clock::now();
  res.compilation_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(finish - start).count();
  return res;
}

bool HermesRuntimeCompiler::ValidateBytecode(const uint8_t* bytecode_data, size_t length) {
  if (!bytecode_data || length < 4) {
    return false;
  }
  auto* root_api = facebook::jsi::castInterface<facebook::hermes::IHermesRootAPI>(facebook::hermes::makeHermesRootAPI());
  if (root_api) {
    return root_api->isHermesBytecode(bytecode_data, length);
  }
  return (bytecode_data[0] == 0x1F && bytecode_data[1] == 'H' && bytecode_data[2] == 'B' && bytecode_data[3] == 'C');
}

uint64_t HermesRuntimeCompiler::ExtractBytecodeHash(const uint8_t* bytecode_data, size_t length) {
  if (!bytecode_data || length == 0) {
    return 0;
  }
  return ComputeFnv1a64(std::string(reinterpret_cast<const char*>(bytecode_data), length));
}

void HermesRuntimeCompiler::AttachRuntimeAdapter(std::shared_ptr<HermesRuntimeAdapter> adapter) {
  adapter_ = std::move(adapter);
}

bool HermesRuntimeCompiler::HotReloadBundle(const std::string& bundle_name, const uint8_t* bytecode_data, size_t length) {
  if (!ValidateBytecode(bytecode_data, length)) {
    return false;
  }

  if (adapter_ && adapter_->IsInitialized()) {
    auto eval_res = adapter_->EvaluateBytecode(bytecode_data, length, bundle_name);
    if (!eval_res.IsSuccess()) {
      return false;
    }
  }

  loaded_bundles_.push_back(bundle_name);
  return true;
}

} // namespace lynxfita
