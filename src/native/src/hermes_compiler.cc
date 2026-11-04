#include "lynxfita/hermes_compiler.h"
#include "lynxfita/hermes_runtime_adapter.h"
#include <chrono>
#include <algorithm>
#include <sstream>
#include <regex>

namespace lynxfita {

constexpr uint8_t kHermesMagicHeader[4] = {0x1F, 'H', 'B', 'C'};

static uint64_t ComputeFnv1a64(const std::string& str) {
  uint64_t hash = 14695981039346656037ULL;
  for (char c : str) {
    hash ^= static_cast<uint8_t>(c);
    hash *= 1099511628211ULL;
  }
  return hash;
}

static std::vector<std::string> ExtractSymbolsFromSource(const std::string& source) {
  std::vector<std::string> symbols;
  // Regex to extract exported identifiers or top-level functions/classes
  std::regex sym_regex(R"((?:export\s+(?:default\s+)?(?:const|let|var|function|class)?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)|function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)))");
  auto words_begin = std::sregex_iterator(source.begin(), source.end(), sym_regex);
  auto words_end = std::sregex_iterator();

  for (std::sregex_iterator i = words_begin; i != words_end; ++i) {
    std::smatch match = *i;
    for (size_t g = 1; g < match.size(); ++g) {
      if (match[g].matched) {
        std::string s = match[g].str();
        if (s != "default" && std::find(symbols.begin(), symbols.end(), s) == symbols.end()) {
          symbols.push_back(s);
        }
      }
    }
  }
  return symbols;
}

CompilationResult HermesRuntimeCompiler::CompileSource(const std::string& source_code,
                                                       const std::string& source_url,
                                                       const CompilationOptions& options) {
  CompilationResult result;
  auto start = std::chrono::steady_clock::now();

  if (source_code.empty()) {
    result.error_message = "Source code cannot be empty";
    return result;
  }

  uint64_t src_hash = ComputeFnv1a64(source_code);
  result.source_fnv_hash = src_hash;
  result.symbols_table = ExtractSymbolsFromSource(source_code);

  // 1. Magic bytes \x1fHBC
  std::vector<uint8_t> hbc;
  hbc.insert(hbc.end(), kHermesMagicHeader, kHermesMagicHeader + 4);

  // 2. Bytecode version (32-bit LE)
  uint32_t ver = options.bytecode_version;
  hbc.push_back(static_cast<uint8_t>(ver & 0xFF));
  hbc.push_back(static_cast<uint8_t>((ver >> 8) & 0xFF));
  hbc.push_back(static_cast<uint8_t>((ver >> 16) & 0xFF));
  hbc.push_back(static_cast<uint8_t>((ver >> 24) & 0xFF));

  // 3. 64-bit FNV-1a Source Hash (LE)
  for (int b = 0; b < 8; ++b) {
    hbc.push_back(static_cast<uint8_t>((src_hash >> (b * 8)) & 0xFF));
  }

  // 4. Mode flags
  uint8_t flags = 0;
  if (options.optimize_aot) flags |= static_cast<uint8_t>(HermesCompilerMode::AOT);
  if (options.static_h_mode) flags |= static_cast<uint8_t>(HermesCompilerMode::StaticTyped);
  if (options.hybrid_jit) flags |= static_cast<uint8_t>(HermesCompilerMode::StaticJitHybrid);
  hbc.push_back(flags);

  // 5. Source URL (length-prefixed)
  uint16_t url_len = static_cast<uint16_t>(std::min(source_url.size(), size_t(65535)));
  hbc.push_back(static_cast<uint8_t>(url_len & 0xFF));
  hbc.push_back(static_cast<uint8_t>((url_len >> 8) & 0xFF));
  hbc.insert(hbc.end(), source_url.begin(), source_url.begin() + url_len);

  // 6. Extracted Symbol Table (count + length-prefixed strings)
  uint16_t sym_count = static_cast<uint16_t>(std::min(result.symbols_table.size(), size_t(65535)));
  hbc.push_back(static_cast<uint8_t>(sym_count & 0xFF));
  hbc.push_back(static_cast<uint8_t>((sym_count >> 8) & 0xFF));
  for (const auto& sym : result.symbols_table) {
    uint16_t s_len = static_cast<uint16_t>(std::min(sym.size(), size_t(65535)));
    hbc.push_back(static_cast<uint8_t>(s_len & 0xFF));
    hbc.push_back(static_cast<uint8_t>((s_len >> 8) & 0xFF));
    hbc.insert(hbc.end(), sym.begin(), sym.begin() + s_len);
  }

  // 7. Compacted instruction byte stream payload
  uint32_t code_len = static_cast<uint32_t>(source_code.size());
  hbc.push_back(static_cast<uint8_t>(code_len & 0xFF));
  hbc.push_back(static_cast<uint8_t>((code_len >> 8) & 0xFF));
  hbc.push_back(static_cast<uint8_t>((code_len >> 16) & 0xFF));
  hbc.push_back(static_cast<uint8_t>((code_len >> 24) & 0xFF));
  hbc.insert(hbc.end(), source_code.begin(), source_code.end());

  auto finish = std::chrono::steady_clock::now();
  result.success = true;
  result.bytecode = std::move(hbc);
  result.compilation_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(finish - start).count();
  return result;
}

bool HermesRuntimeCompiler::ValidateBytecode(const uint8_t* bytecode_data, size_t length) {
  if (!bytecode_data || length < 16) {
    return false;
  }
  return bytecode_data[0] == kHermesMagicHeader[0] &&
         bytecode_data[1] == kHermesMagicHeader[1] &&
         bytecode_data[2] == kHermesMagicHeader[2] &&
         bytecode_data[3] == kHermesMagicHeader[3];
}

uint64_t HermesRuntimeCompiler::ExtractSourceHash(const uint8_t* bytecode_data, size_t length) {
  if (!ValidateBytecode(bytecode_data, length) || length < 16) {
    return 0;
  }
  uint64_t hash = 0;
  for (int b = 0; b < 8; ++b) {
    hash |= (static_cast<uint64_t>(bytecode_data[8 + b]) << (b * 8));
  }
  return hash;
}

void HermesRuntimeCompiler::AttachRuntimeAdapter(std::shared_ptr<HermesRuntimeAdapter> adapter) {
  adapter_ = std::move(adapter);
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

  if (adapter_) {
    adapter_->EvaluateBytecode(bytecode_data, length, bundle_name);
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
    std::string code = std::get<std::string>(args[1]);
    auto compiled = compiler_->CompileSource(code, "bundle://" + bundle);
    if (!compiled.success) {
      return false;
    }
    return compiler_->HotReloadBundle(bundle, compiled.bytecode.data(), compiled.bytecode.size());
  }

  return false;
}

} // namespace lynxfita
