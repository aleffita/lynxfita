#pragma once

#include "lynxfita/jsi_types.h"
#include <vector>
#include <string>
#include <cstdint>
#include <unordered_map>
#include <variant>

namespace lynxfita {

enum class WireType : uint8_t {
  Varint = 0,
  Fixed64 = 1,
  LengthDelimited = 2,
  StartGroup = 3,
  EndGroup = 4,
  Fixed32 = 5
};

using ProtobufValue = std::variant<uint64_t, std::string, std::vector<uint8_t>, double>;

struct ProtobufField {
  uint32_t field_number;
  WireType wire_type;
  ProtobufValue value;
};

// Lightweight header-only Protocol Buffer binary wire encoder & decoder
class ProtobufBridge {
 public:
  ProtobufBridge() = default;
  ~ProtobufBridge() = default;

  // Varint primitive encode / decode
  static void EncodeVarint(uint64_t value, std::vector<uint8_t>& buffer);
  static bool DecodeVarint(const uint8_t*& ptr, const uint8_t* end, uint64_t& value);

  // Field tag helpers
  static void EncodeTag(uint32_t field_number, WireType wire_type, std::vector<uint8_t>& buffer);
  static bool DecodeTag(const uint8_t*& ptr, const uint8_t* end, uint32_t& field_number, WireType& wire_type);

  // High-level message serialization
  static std::vector<uint8_t> SerializeFields(const std::vector<ProtobufField>& fields);
  static bool DeserializeFields(const uint8_t* data, size_t length, std::vector<ProtobufField>& out_fields);

  // Bridge dispatch payload helpers
  static std::vector<uint8_t> EncodeMethodCall(const std::string& module_name, const std::string& method_name, const std::string& payload);
  static bool DecodeMethodCall(const uint8_t* data, size_t length, std::string& out_module, std::string& out_method, std::string& out_payload);
};

} // namespace lynxfita
