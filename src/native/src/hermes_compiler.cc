#include "lynxfita/hermes_compiler.h"
#include "lynxfita/hermes_runtime_adapter.h"
#include <chrono>
#include <algorithm>
#include <sstream>
#include <regex>
#include <cstring>
#include <cstdint>
#include <cmath>
#include <cctype>

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

// Token types for expression compilation
enum class TokenType {
  Number,
  StringLiteral,
  Identifier,
  Plus,
  Minus,
  Multiply,
  Divide,
  LParen,
  RParen,
  Comma,
  End
};

struct Token {
  TokenType type;
  std::string text;
  double num_value{0.0};
};

static std::vector<Token> TokenizeExpression(const std::string& expr) {
  std::vector<Token> tokens;
  size_t i = 0;
  while (i < expr.size()) {
    char c = expr[i];
    if (std::isspace(static_cast<unsigned char>(c))) {
      i++;
      continue;
    }
    if (c == '+') { tokens.push_back({TokenType::Plus, "+"}); i++; continue; }
    if (c == '-') { tokens.push_back({TokenType::Minus, "-"}); i++; continue; }
    if (c == '*') { tokens.push_back({TokenType::Multiply, "*"}); i++; continue; }
    if (c == '/') { tokens.push_back({TokenType::Divide, "/"}); i++; continue; }
    if (c == '(') { tokens.push_back({TokenType::LParen, "("}); i++; continue; }
    if (c == ')') { tokens.push_back({TokenType::RParen, ")"}); i++; continue; }
    if (c == ',') { tokens.push_back({TokenType::Comma, ","}); i++; continue; }

    // String literal '...' or "..."
    if (c == '\'' || c == '"') {
      char quote = c;
      i++;
      std::string str;
      while (i < expr.size() && expr[i] != quote) {
        str.push_back(expr[i]);
        i++;
      }
      if (i < expr.size()) i++; // skip closing quote
      tokens.push_back({TokenType::StringLiteral, str});
      continue;
    }

    // Number
    if (std::isdigit(static_cast<unsigned char>(c)) || (c == '.' && i + 1 < expr.size() && std::isdigit(static_cast<unsigned char>(expr[i + 1])))) {
      size_t start = i;
      while (i < expr.size() && (std::isdigit(static_cast<unsigned char>(expr[i])) || expr[i] == '.')) {
        i++;
      }
      std::string num_str = expr.substr(start, i - start);
      double val = std::stod(num_str);
      tokens.push_back({TokenType::Number, num_str, val});
      continue;
    }

    // Identifier
    if (std::isalpha(static_cast<unsigned char>(c)) || c == '_' || c == '$') {
      size_t start = i;
      while (i < expr.size() && (std::isalnum(static_cast<unsigned char>(expr[i])) || expr[i] == '_' || expr[i] == '$')) {
        i++;
      }
      tokens.push_back({TokenType::Identifier, expr.substr(start, i - start)});
      continue;
    }

    i++; // Skip unknown punctuation like ; or =
  }
  return tokens;
}

static void EmitFloat64(std::vector<uint8_t>& code, double val) {
  code.push_back(static_cast<uint8_t>(HbcOpcode::OP_CONST_F64));
  uint64_t raw;
  std::memcpy(&raw, &val, sizeof(double));
  for (int b = 0; b < 8; ++b) {
    code.push_back(static_cast<uint8_t>((raw >> (b * 8)) & 0xFF));
  }
}

static void EmitString(std::vector<uint8_t>& code, const std::string& str) {
  code.push_back(static_cast<uint8_t>(HbcOpcode::OP_CONST_STR));
  uint16_t len = static_cast<uint16_t>(std::min(str.size(), size_t(65535)));
  code.push_back(static_cast<uint8_t>(len & 0xFF));
  code.push_back(static_cast<uint8_t>((len >> 8) & 0xFF));
  code.insert(code.end(), str.begin(), str.begin() + len);
}

static void EmitLoadArg(std::vector<uint8_t>& code, uint8_t arg_idx) {
  code.push_back(static_cast<uint8_t>(HbcOpcode::OP_LOAD_ARG));
  code.push_back(arg_idx);
}

static void EmitHostCall(std::vector<uint8_t>& code, const std::string& host_fn, uint8_t argc) {
  code.push_back(static_cast<uint8_t>(HbcOpcode::OP_CALL_HOST));
  uint16_t len = static_cast<uint16_t>(std::min(host_fn.size(), size_t(65535)));
  code.push_back(static_cast<uint8_t>(len & 0xFF));
  code.push_back(static_cast<uint8_t>((len >> 8) & 0xFF));
  code.insert(code.end(), host_fn.begin(), host_fn.begin() + len);
  code.push_back(argc);
}

static int GetPrecedence(TokenType type) {
  if (type == TokenType::Multiply || type == TokenType::Divide) return 2;
  if (type == TokenType::Plus || type == TokenType::Minus) return 1;
  return 0;
}

// Compiles expression tokens into bytecode using shunting yard algorithm
static std::vector<uint8_t> CompileTokensToBytecode(
    const std::vector<Token>& tokens,
    const std::vector<std::string>& arg_names) {
  std::vector<uint8_t> code;
  std::vector<Token> op_stack;

  auto flush_op = [&](const Token& op) {
    if (op.type == TokenType::Plus) code.push_back(static_cast<uint8_t>(HbcOpcode::OP_ADD));
    else if (op.type == TokenType::Minus) code.push_back(static_cast<uint8_t>(HbcOpcode::OP_SUB));
    else if (op.type == TokenType::Multiply) code.push_back(static_cast<uint8_t>(HbcOpcode::OP_MUL));
    else if (op.type == TokenType::Divide) code.push_back(static_cast<uint8_t>(HbcOpcode::OP_DIV));
  };

  for (size_t idx = 0; idx < tokens.size(); ++idx) {
    const auto& tok = tokens[idx];

    if (tok.type == TokenType::Number) {
      EmitFloat64(code, tok.num_value);
    } else if (tok.type == TokenType::StringLiteral) {
      EmitString(code, tok.text);
    } else if (tok.type == TokenType::Identifier) {
      // Check if this is a function call like `fn(arg)`
      if (idx + 1 < tokens.size() && tokens[idx + 1].type == TokenType::LParen) {
        std::string fn_name = tok.text;
        idx += 2; // skip fn_name and LParen
        uint8_t call_argc = 0;
        std::vector<Token> arg_tokens;
        int paren_depth = 1;
        while (idx < tokens.size() && paren_depth > 0) {
          if (tokens[idx].type == TokenType::LParen) paren_depth++;
          else if (tokens[idx].type == TokenType::RParen) {
            paren_depth--;
            if (paren_depth == 0) break;
          }
          if (paren_depth == 1 && tokens[idx].type == TokenType::Comma) {
            if (!arg_tokens.empty()) {
              auto arg_code = CompileTokensToBytecode(arg_tokens, arg_names);
              code.insert(code.end(), arg_code.begin(), arg_code.end());
              call_argc++;
              arg_tokens.clear();
            }
          } else {
            arg_tokens.push_back(tokens[idx]);
          }
          idx++;
        }
        if (!arg_tokens.empty()) {
          auto arg_code = CompileTokensToBytecode(arg_tokens, arg_names);
          code.insert(code.end(), arg_code.begin(), arg_code.end());
          call_argc++;
        }
        EmitHostCall(code, fn_name, call_argc);
      } else {
        // Find identifier in parameter list
        auto it = std::find(arg_names.begin(), arg_names.end(), tok.text);
        if (it != arg_names.end()) {
          uint8_t arg_idx = static_cast<uint8_t>(std::distance(arg_names.begin(), it));
          EmitLoadArg(code, arg_idx);
        } else {
          // Unknown identifier: emit string
          EmitString(code, tok.text);
        }
      }
    } else if (tok.type == TokenType::Plus || tok.type == TokenType::Minus ||
               tok.type == TokenType::Multiply || tok.type == TokenType::Divide) {
      while (!op_stack.empty() && op_stack.back().type != TokenType::LParen &&
             GetPrecedence(op_stack.back().type) >= GetPrecedence(tok.type)) {
        flush_op(op_stack.back());
        op_stack.pop_back();
      }
      op_stack.push_back(tok);
    } else if (tok.type == TokenType::LParen) {
      op_stack.push_back(tok);
    } else if (tok.type == TokenType::RParen) {
      while (!op_stack.empty() && op_stack.back().type != TokenType::LParen) {
        flush_op(op_stack.back());
        op_stack.pop_back();
      }
      if (!op_stack.empty() && op_stack.back().type == TokenType::LParen) {
        op_stack.pop_back();
      }
    }
  }

  while (!op_stack.empty()) {
    if (op_stack.back().type != TokenType::LParen) {
      flush_op(op_stack.back());
    }
    op_stack.pop_back();
  }

  return code;
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

  // Parse arguments and body
  std::vector<std::string> arg_names;
  std::string expr_body = source_code;

  // Arrow function pattern: (arg1, arg2) => expr or arg => expr
  std::regex arrow_regex(R"((?:\(([^)]*)\)|([a-zA-Z_$][a-zA-Z0-9_$]*))\s*=>\s*([\s\S]+))");
  std::smatch arrow_match;
  if (std::regex_search(source_code, arrow_match, arrow_regex)) {
    std::string params_str = arrow_match[1].matched ? arrow_match[1].str() : arrow_match[2].str();
    expr_body = arrow_match[3].str();

    std::regex param_id_regex(R"([a-zA-Z_$][a-zA-Z0-9_$]*)");
    auto p_begin = std::sregex_iterator(params_str.begin(), params_str.end(), param_id_regex);
    auto p_end = std::sregex_iterator();
    for (auto it = p_begin; it != p_end; ++it) {
      arg_names.push_back(it->str());
    }
  } else {
    // Check for "export const ... = <expr>" or "const ... = <expr>"
    std::regex assign_regex(R"((?:export\s+)?(?:const|let|var)\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*([^;]+);?)");
    std::smatch assign_match;
    if (std::regex_search(source_code, assign_match, assign_regex)) {
      expr_body = assign_match[1].str();
    }
  }

  // Tokenize and compile body into real bytecode opcodes
  auto tokens = TokenizeExpression(expr_body);
  auto instruction_stream = CompileTokensToBytecode(tokens, arg_names);
  if (instruction_stream.empty()) {
    // Default fallback: 0
    EmitFloat64(instruction_stream, 0.0);
  }
  // Terminate with OP_RET
  instruction_stream.push_back(static_cast<uint8_t>(HbcOpcode::OP_RET));

  // Build HBC container
  std::vector<uint8_t> hbc;
  // 1. Magic bytes \x1fHBC
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
  uint32_t code_len = static_cast<uint32_t>(instruction_stream.size());
  hbc.push_back(static_cast<uint8_t>(code_len & 0xFF));
  hbc.push_back(static_cast<uint8_t>((code_len >> 8) & 0xFF));
  hbc.push_back(static_cast<uint8_t>((code_len >> 16) & 0xFF));
  hbc.push_back(static_cast<uint8_t>((code_len >> 24) & 0xFF));
  hbc.insert(hbc.end(), instruction_stream.begin(), instruction_stream.end());

  auto finish = std::chrono::steady_clock::now();
  result.success = true;
  result.bytecode = std::move(hbc);
  result.compilation_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(finish - start).count();
  return result;
}

bool HermesRuntimeCompiler::ValidateBytecode(const uint8_t* bytecode_data, size_t length) {
  if (!bytecode_data || length < 4) {
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

  if (adapter_) {
    auto eval_res = adapter_->EvaluateBytecode(bytecode_data, length, bundle_name);
    if (!eval_res.IsSuccess()) {
      return false;
    }
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
