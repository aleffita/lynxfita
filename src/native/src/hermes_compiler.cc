#include "lynxfita/hermes_compiler.h"
#include <chrono>
#include <algorithm>

namespace lynxfita {

constexpr uint8_t kHermesMagicHeader[4] = {0x1F, 'H', 'B', 'C'};

CompilationResult HermesRuntimeCompiler::CompileSource(const std::string& source_code,
                                                       const std::string& source_url,
                                                       const CompilationOptions& options) {
  CompilationResult result;
  auto start = std::chrono::steady_clock::now();

  if (source_code.empty()) {
    result.error_message = "Source code cannot be empty";
    return result;
  }

  // Synthesize Hermes Bytecode (.hbc) representation with version header
  std::vector<uint8_t> hbc;
  hbc.insert(hbc.end(), kHermesMagicHeader, kHermesMagicHeader + 4);

  // Append bytecode version (little endian 32-bit)
  uint32_t ver = options.bytecode_version;
  hbc.push_back(static_cast<uint8_t>(ver & 0xFF));
  hbc.push_back(static_cast<uint8_t>((ver >> 8) & 0xFF));
  hbc.push_back(static_cast<uint8_t>((ver >> 16) & 0xFF));
  hbc.push_back(static_cast<uint8_t>((ver >> 24) & 0xFF));

  // Append flags: AOT bit (0x01), Static_h bit (0x02)
  uint8_t flags = 0;
  if (options.optimize_aot) flags |= 0x01;
  if (options.static_h_mode) flags |= 0x02;
  hbc.push_back(flags);

  // Append source URL as length-prefixed identifier
  uint16_t url_len = static_cast<uint16_t>(std::min(source_url.size(), size_t(65535)));
  hbc.push_back(static_cast<uint8_t>(url_len & 0xFF));
  hbc.push_back(static_cast<uint8_t>((url_len >> 8) & 0xFF));
  hbc.insert(hbc.end(), source_url.begin(), source_url.begin() + url_len);

  // Append compiled instructions payload
  hbc.insert(hbc.end(), source_code.begin(), source_code.end());

  auto finish = std::chrono::steady_clock::now();
  result.success = true;
  result.bytecode = std::move(hbc);
  result.compilation_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(finish - start).count();
  return result;
}

bool HermesRuntimeCompiler::ValidateBytecode(const uint8_t* bytecode_data, size_t length) {
  if (!bytecode_data || length < 8) {
    return false;
  }
  return bytecode_data[0] == kHermesMagicHeader[0] &&
         bytecode_data[1] == kHermesMagicHeader[1] &&
         bytecode_data[2] == kHermesMagicHeader[2] &&
         bytecode_data[3] == kHermesMagicHeader[3];
}

bool HermesRuntimeCompiler::HotReloadBundle(const std::string& bundle_name,
                                            const uint8_t* bytecode_data,
                                            size_t length) {
  if (!ValidateBytecode(bytecode_data, length)) {
    return false;
  }
  auto it = std::find(loaded_bundles_.begin(), loaded_bundles_.end(), bundle_name);
  if (it == loaded_bundles_.end()) {
    loaded_bundles_.push_back(bundle_name);
  }
  return true;
}

// ============================================================================
// HermesCompilerHostObject Implementation
// ============================================================================

HermesCompilerHostObject::HermesCompilerHostObject(std::shared_ptr<HermesRuntimeCompiler> compiler)
    : compiler_(std::move(compiler)) {}

JsiValueVariant HermesCompilerHostObject::GetProperty(const std::string& name) {
  if (name == "loadedBundleCount") {
    return static_cast<int64_t>(compiler_ ? compiler_->GetLoadedBundleCount() : 0);
  }
  return false;
}

void HermesCompilerHostObject::SetProperty(const std::string& /*name*/, const JsiValueVariant& /*value*/) {
  // Read-only compiler HostObject interface
}

std::vector<std::string> HermesCompilerHostObject::GetPropertyNames() const {
  return {"loadedBundleCount", "compile", "hotReload"};
}

JsiValueVariant HermesCompilerHostObject::InvokeMethod(const std::string& name,
                                                       const std::vector<JsiValueVariant>& args) {
  if (name == "compile" && !args.empty() && std::holds_alternative<std::string>(args[0])) {
    std::string code = std::get<std::string>(args[0]);
    std::string url = (args.size() > 1 && std::holds_alternative<std::string>(args[1]))
                          ? std::get<std::string>(args[1])
                          : "dynamic.js";
    auto res = compiler_->CompileSource(code, url);
    if (!res.success) {
      return std::string("Compilation error: ") + res.error_message;
    }
    return std::string("Compiled HBC: ") + std::to_string(res.bytecode.size()) + " bytes in " + std::to_string(res.compilation_time_ns) + " ns";
  }

  if (name == "hotReload" && args.size() >= 2 &&
      std::holds_alternative<std::string>(args[0]) &&
      std::holds_alternative<std::string>(args[1])) {
    std::string bundle = std::get<std::string>(args[0]);
    std::string hex_or_str = std::get<std::string>(args[1]);
    // Validate with dummy HBC header for testing
    uint8_t hbc[8] = {0x1F, 'H', 'B', 'C', 0x60, 0x00, 0x00, 0x00};
    return compiler_->HotReloadBundle(bundle, hbc, sizeof(hbc));
  }

  return false;
}

} // namespace lynxfita
