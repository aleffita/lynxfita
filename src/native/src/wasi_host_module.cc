#include "lynxfita/wasi_host_module.h"
#include <stdexcept>
#include <chrono>
#include <cstring>
#include <cstdint>
#include <cmath>
#include <iostream>
#include <algorithm>

namespace lynxfita {

static uint32_t DecodeUleb128(const uint8_t*& ptr, const uint8_t* end) {
  uint32_t result = 0;
  uint32_t shift = 0;
  while (ptr < end) {
    uint8_t byte = *ptr++;
    result |= (static_cast<uint32_t>(byte & 0x7F) << shift);
    if ((byte & 0x80) == 0) {
      break;
    }
    shift += 7;
  }
  return result;
}

static int32_t DecodeSleb128(const uint8_t*& ptr, const uint8_t* end) {
  int32_t result = 0;
  uint32_t shift = 0;
  uint8_t byte = 0;
  while (ptr < end) {
    byte = *ptr++;
    result |= (static_cast<int32_t>(byte & 0x7F) << shift);
    shift += 7;
    if ((byte & 0x80) == 0) {
      break;
    }
  }
  if ((shift < 32) && (byte & 0x40)) {
    result |= (~0 << shift);
  }
  return result;
}

WasiHostModule::WasiHostModule(const std::string& module_name, WasiCapabilities caps)
    : module_name_(module_name), capabilities_(caps) {
  linear_memory_.resize(64 * 1024, 0); // Initial 1 page (64KB) memory
}

WasiHostModule::~WasiHostModule() = default;

uint8_t* WasiHostModule::GetMemoryData() {
  if (dma_bound_memory_) {
    return dma_bound_memory_;
  }
  return linear_memory_.data();
}

const uint8_t* WasiHostModule::GetMemoryData() const {
  if (dma_bound_memory_) {
    return dma_bound_memory_;
  }
  return linear_memory_.data();
}

size_t WasiHostModule::GetMemoryCapacity() const {
  if (dma_bound_memory_) {
    return dma_bound_capacity_;
  }
  return linear_memory_.size();
}

size_t WasiHostModule::GetMemoryUsage() const {
  return GetMemoryCapacity();
}

void WasiHostModule::BindDmaMemory(uint8_t* dma_buffer, size_t capacity) {
  dma_bound_memory_ = dma_buffer;
  dma_bound_capacity_ = capacity;
}

JsiValueVariant WasiHostModule::GetProperty(const std::string& name) {
  if (name == "moduleName") {
    return module_name_;
  }
  if (name == "memorySize") {
    return static_cast<int64_t>(GetMemoryCapacity());
  }
  return std::monostate{};
}

void WasiHostModule::SetProperty(const std::string& /*name*/, const JsiValueVariant& /*value*/) {
  // Read-only host module properties
}

std::vector<std::string> WasiHostModule::GetPropertyNames() const {
  std::vector<std::string> names = {"moduleName", "memorySize", "execute"};
  for (const auto& [name, _] : exports_) {
    names.push_back(name);
  }
  for (const auto& [name, _] : wasm_exported_functions_) {
    names.push_back(name);
  }
  return names;
}

JsiValueVariant WasiHostModule::InvokeMethod(const std::string& method_name,
                                            const std::vector<JsiValueVariant>& args) {
  if (method_name == "execute") {
    if (args.empty() || !std::holds_alternative<std::string>(args[0])) {
      throw std::runtime_error("execute requires function name string as first parameter");
    }
    std::string entry = std::get<std::string>(args[0]);
    std::vector<JsiValueVariant> forward_args;
    for (size_t i = 1; i < args.size(); ++i) {
      forward_args.push_back(args[i]);
    }
    auto res = Execute(entry, forward_args);
    if (!res.IsSuccess()) {
      throw std::runtime_error(res.error_message);
    }
    return res.result_payload;
  }

  auto it = exports_.find(method_name);
  if (it != exports_.end()) {
    return it->second(args);
  }

  auto wasm_it = wasm_exported_functions_.find(method_name);
  if (wasm_it != wasm_exported_functions_.end()) {
    return ExecuteWasmFunction(wasm_it->second, args);
  }

  throw std::runtime_error("WASI method not found: " + method_name);
}

bool WasiHostModule::LoadWasmBinary(const uint8_t* wasm_bytes, size_t length) {
  if (!wasm_bytes || length < 8) {
    return false;
  }
  // WASM magic header: \0asm (0x00, 0x61, 0x73, 0x6d)
  if (wasm_bytes[0] != 0x00 || wasm_bytes[1] != 0x61 || wasm_bytes[2] != 0x73 || wasm_bytes[3] != 0x6d) {
    return false;
  }

  // Version: 1
  uint32_t version = static_cast<uint32_t>(wasm_bytes[4]) |
                     (static_cast<uint32_t>(wasm_bytes[5]) << 8) |
                     (static_cast<uint32_t>(wasm_bytes[6]) << 16) |
                     (static_cast<uint32_t>(wasm_bytes[7]) << 24);
  if (version != 1) {
    return false;
  }

  // If this is the minimal valid stub header (8 bytes), instantiate and return true
  if (length == 8) {
    is_instantiated_ = true;
    return true;
  }

  // Parse Sections using LEB128
  const uint8_t* ptr = wasm_bytes + 8;
  const uint8_t* end = wasm_bytes + length;

  std::vector<uint32_t> func_type_indices;

  while (ptr < end) {
    uint8_t section_id = *ptr++;
    uint32_t section_len = DecodeUleb128(ptr, end);
    const uint8_t* section_end = ptr + section_len;
    if (section_end > end) {
      break;
    }

    switch (section_id) {
      case 0x01: { // Type section
        uint32_t type_count = DecodeUleb128(ptr, section_end);
        for (uint32_t t = 0; t < type_count && ptr < section_end; ++t) {
          uint8_t form = *ptr++; // 0x60 = func
          uint32_t param_count = DecodeUleb128(ptr, section_end);
          ptr += param_count; // skip param types
          uint32_t ret_count = DecodeUleb128(ptr, section_end);
          ptr += ret_count; // skip return types
        }
        break;
      }
      case 0x03: { // Function section
        uint32_t func_count = DecodeUleb128(ptr, section_end);
        for (uint32_t f = 0; f < func_count && ptr < section_end; ++f) {
          uint32_t type_idx = DecodeUleb128(ptr, section_end);
          func_type_indices.push_back(type_idx);
        }
        break;
      }
      case 0x05: { // Memory section
        uint32_t mem_count = DecodeUleb128(ptr, section_end);
        for (uint32_t m = 0; m < mem_count && ptr < section_end; ++m) {
          uint8_t flags = *ptr++;
          uint32_t initial_pages = DecodeUleb128(ptr, section_end);
          size_t initial_bytes = static_cast<size_t>(initial_pages) * 64 * 1024;
          if (initial_bytes > linear_memory_.size() && initial_bytes <= capabilities_.memory_limit_bytes) {
            linear_memory_.resize(initial_bytes, 0);
          }
          if (flags & 0x01) {
            uint32_t max_pages = DecodeUleb128(ptr, section_end);
          }
        }
        break;
      }
      case 0x07: { // Export section
        uint32_t export_count = DecodeUleb128(ptr, section_end);
        for (uint32_t e = 0; e < export_count && ptr < section_end; ++e) {
          uint32_t name_len = DecodeUleb128(ptr, section_end);
          std::string name(reinterpret_cast<const char*>(ptr), name_len);
          ptr += name_len;
          uint8_t kind = *ptr++;
          uint32_t index = DecodeUleb128(ptr, section_end);
          if (kind == 0x00) { // Function export
            wasm_exported_functions_[name] = index;
          }
        }
        break;
      }
      case 0x0A: { // Code section
        uint32_t code_count = DecodeUleb128(ptr, section_end);
        for (uint32_t c = 0; c < code_count && ptr < section_end; ++c) {
          uint32_t body_size = DecodeUleb128(ptr, section_end);
          const uint8_t* body_end = ptr + body_size;

          WasmFunction fn;
          if (c < func_type_indices.size()) {
            fn.type_index = func_type_indices[c];
          }

          uint32_t local_decls = DecodeUleb128(ptr, body_end);
          for (uint32_t l = 0; l < local_decls && ptr < body_end; ++l) {
            uint32_t count = DecodeUleb128(ptr, body_end);
            uint8_t val_type = *ptr++;
            for (uint32_t k = 0; k < count; ++k) {
              fn.local_types.push_back(val_type);
            }
          }

          if (ptr < body_end) {
            fn.code_bytes.assign(ptr, body_end);
          }
          wasm_functions_.push_back(std::move(fn));
          ptr = body_end;
        }
        break;
      }
      default:
        // Skip unknown custom section
        ptr = section_end;
        break;
    }
    ptr = section_end;
  }

  is_instantiated_ = true;
  return true;
}

static double ExtractNumber(const JsiValueVariant& v) {
  if (std::holds_alternative<double>(v)) return std::get<double>(v);
  if (std::holds_alternative<int64_t>(v)) return static_cast<double>(std::get<int64_t>(v));
  if (std::holds_alternative<bool>(v)) return std::get<bool>(v) ? 1.0 : 0.0;
  if (std::holds_alternative<std::string>(v)) {
    try {
      return std::stod(std::get<std::string>(v));
    } catch (...) {
      return 0.0;
    }
  }
  return 0.0;
}

JsiValueVariant WasiHostModule::ExecuteWasmFunction(uint32_t func_index, const std::vector<JsiValueVariant>& args) {
  if (func_index >= wasm_functions_.size()) {
    throw std::runtime_error("Wasm function index out of bounds: " + std::to_string(func_index));
  }

  const auto& fn = wasm_functions_[func_index];
  std::vector<double> locals;
  for (const auto& a : args) {
    locals.push_back(ExtractNumber(a));
  }
  // Initialize additional locals to 0
  for (size_t l = 0; l < fn.local_types.size(); ++l) {
    locals.push_back(0.0);
  }

  std::vector<double> stack;
  const uint8_t* ip = fn.code_bytes.data();
  const uint8_t* end = ip + fn.code_bytes.size();

  uint8_t* mem_ptr = GetMemoryData();
  size_t mem_capacity = GetMemoryCapacity();

  while (ip < end) {
    uint8_t opcode = *ip++;
    if (opcode == 0x0B) { // end
      break;
    }

    switch (opcode) {
      case 0x20: { // local.get
        uint32_t idx = DecodeUleb128(ip, end);
        stack.push_back(idx < locals.size() ? locals[idx] : 0.0);
        break;
      }
      case 0x21: { // local.set
        uint32_t idx = DecodeUleb128(ip, end);
        if (!stack.empty()) {
          double val = stack.back(); stack.pop_back();
          if (idx < locals.size()) {
            locals[idx] = val;
          }
        }
        break;
      }
      case 0x41: { // i32.const
        int32_t c = DecodeSleb128(ip, end);
        stack.push_back(static_cast<double>(c));
        break;
      }
      case 0x43: { // f32.const
        if (ip + 4 <= end) {
          float f;
          std::memcpy(&f, ip, sizeof(float));
          ip += 4;
          stack.push_back(static_cast<double>(f));
        }
        break;
      }
      case 0x6A: { // i32.add
        if (stack.size() >= 2) {
          int32_t b = static_cast<int32_t>(stack.back()); stack.pop_back();
          int32_t a = static_cast<int32_t>(stack.back()); stack.pop_back();
          stack.push_back(static_cast<double>(a + b));
        }
        break;
      }
      case 0x6B: { // i32.sub
        if (stack.size() >= 2) {
          int32_t b = static_cast<int32_t>(stack.back()); stack.pop_back();
          int32_t a = static_cast<int32_t>(stack.back()); stack.pop_back();
          stack.push_back(static_cast<double>(a - b));
        }
        break;
      }
      case 0x6C: { // i32.mul
        if (stack.size() >= 2) {
          int32_t b = static_cast<int32_t>(stack.back()); stack.pop_back();
          int32_t a = static_cast<int32_t>(stack.back()); stack.pop_back();
          stack.push_back(static_cast<double>(a * b));
        }
        break;
      }
      case 0x92: { // f32.add
        if (stack.size() >= 2) {
          float b = static_cast<float>(stack.back()); stack.pop_back();
          float a = static_cast<float>(stack.back()); stack.pop_back();
          stack.push_back(static_cast<double>(a + b));
        }
        break;
      }
      case 0x93: { // f32.sub
        if (stack.size() >= 2) {
          float b = static_cast<float>(stack.back()); stack.pop_back();
          float a = static_cast<float>(stack.back()); stack.pop_back();
          stack.push_back(static_cast<double>(a - b));
        }
        break;
      }
      case 0x94: { // f32.mul
        if (stack.size() >= 2) {
          float b = static_cast<float>(stack.back()); stack.pop_back();
          float a = static_cast<float>(stack.back()); stack.pop_back();
          stack.push_back(static_cast<double>(a * b));
        }
        break;
      }
      case 0x95: { // f32.div
        if (stack.size() >= 2) {
          float b = static_cast<float>(stack.back()); stack.pop_back();
          float a = static_cast<float>(stack.back()); stack.pop_back();
          stack.push_back(b != 0.0f ? static_cast<double>(a / b) : 0.0);
        }
        break;
      }
      case 0x2A: { // f32.load
        uint32_t align = DecodeUleb128(ip, end);
        uint32_t offset = DecodeUleb128(ip, end);
        if (!stack.empty()) {
          uint32_t base = static_cast<uint32_t>(stack.back()); stack.pop_back();
          size_t addr = base + offset;
          if (mem_ptr && addr + sizeof(float) <= mem_capacity) {
            float val = *reinterpret_cast<const float*>(mem_ptr + addr);
            stack.push_back(static_cast<double>(val));
          } else {
            stack.push_back(0.0);
          }
        }
        break;
      }
      case 0x38: { // f32.store
        uint32_t align = DecodeUleb128(ip, end);
        uint32_t offset = DecodeUleb128(ip, end);
        if (stack.size() >= 2) {
          float val = static_cast<float>(stack.back()); stack.pop_back();
          uint32_t base = static_cast<uint32_t>(stack.back()); stack.pop_back();
          size_t addr = base + offset;
          if (mem_ptr && addr + sizeof(float) <= mem_capacity) {
            *reinterpret_cast<float*>(mem_ptr + addr) = val;
          }
        }
        break;
      }
      default:
        break;
    }
  }

  if (!stack.empty()) {
    return stack.back();
  }
  return 0.0;
}

bool WasiHostModule::RegisterExport(const std::string& export_name,
                                   std::function<JsiValueVariant(const std::vector<JsiValueVariant>&)> handler) {
  if (export_name.empty() || !handler) {
    return false;
  }
  exports_[export_name] = std::move(handler);
  return true;
}

ExecutionResult WasiHostModule::Execute(const std::string& entrypoint, const std::vector<JsiValueVariant>& args) {
  ExecutionResult res;
  const auto start = std::chrono::steady_clock::now();

  auto it = exports_.find(entrypoint);
  if (it != exports_.end()) {
    try {
      auto val = it->second(args);
      res.status = StatusCode::Ok;
      res.result_payload = JsiValueToString(val);
    } catch (const std::exception& e) {
      res.status = StatusCode::WasiTrap;
      res.error_message = std::string("WASI trap execution fault: ") + e.what();
    }
    const auto finish = std::chrono::steady_clock::now();
    res.execution_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(finish - start).count();
    return res;
  }

  auto wasm_it = wasm_exported_functions_.find(entrypoint);
  if (wasm_it != wasm_exported_functions_.end()) {
    try {
      auto val = ExecuteWasmFunction(wasm_it->second, args);
      res.status = StatusCode::Ok;
      res.result_payload = JsiValueToString(val);
    } catch (const std::exception& e) {
      res.status = StatusCode::WasiTrap;
      res.error_message = std::string("Wasm trap execution fault: ") + e.what();
    }
    const auto finish = std::chrono::steady_clock::now();
    res.execution_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(finish - start).count();
    return res;
  }

  res.status = StatusCode::MethodNotFound;
  res.error_message = "Entrypoint not exported by WASI module: " + entrypoint;
  return res;
}

bool WasiHostModule::WriteMemory(size_t offset, const uint8_t* data, size_t length) {
  if (!data || length == 0) {
    return true;
  }
  if (offset > capabilities_.memory_limit_bytes || length > capabilities_.memory_limit_bytes - offset) {
    return false; // Exceeds sandbox capability ceiling
  }

  if (dma_bound_memory_) {
    if (offset + length > dma_bound_capacity_) {
      return false;
    }
    std::memcpy(dma_bound_memory_ + offset, data, length);
    return true;
  }

  if (offset > linear_memory_.size() || length > linear_memory_.size() - offset) {
    linear_memory_.resize(offset + length, 0);
  }
  std::memcpy(linear_memory_.data() + offset, data, length);
  return true;
}

bool WasiHostModule::ReadMemory(size_t offset, size_t length, std::vector<uint8_t>& out_bytes) const {
  if (dma_bound_memory_) {
    if (offset > dma_bound_capacity_ || length > dma_bound_capacity_ - offset) {
      return false;
    }
    out_bytes.resize(length);
    std::memcpy(out_bytes.data(), dma_bound_memory_ + offset, length);
    return true;
  }

  if (offset > linear_memory_.size() || length > linear_memory_.size() - offset) {
    return false; // Out of bounds
  }
  out_bytes.resize(length);
  std::memcpy(out_bytes.data(), linear_memory_.data() + offset, length);
  return true;
}

bool WasiHostModule::GrowMemory(size_t additional_bytes) {
  if (dma_bound_memory_) {
    return false; // DMA memory is statically bounded
  }
  if (additional_bytes > capabilities_.memory_limit_bytes - linear_memory_.size()) {
    return false;
  }
  linear_memory_.resize(linear_memory_.size() + additional_bytes, 0);
  return true;
}

} // namespace lynxfita
