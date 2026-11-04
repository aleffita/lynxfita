#include "lynxfita/protobuf_bridge.h"
#include <cstring>

namespace lynxfita {

void ProtobufBridge::EncodeVarint(uint64_t value, std::vector<uint8_t>& buffer) {
  while (value >= 0x80) {
    buffer.push_back(static_cast<uint8_t>((value & 0x7F) | 0x80));
    value >>= 7;
  }
  buffer.push_back(static_cast<uint8_t>(value & 0x7F));
}

bool ProtobufBridge::DecodeVarint(const uint8_t*& ptr, const uint8_t* end, uint64_t& value) {
  value = 0;
  uint32_t shift = 0;
  while (ptr < end && shift < 64) {
    uint8_t b = *ptr++;
    value |= static_cast<uint64_t>(b & 0x7F) << shift;
    if ((b & 0x80) == 0) {
      return true;
    }
    shift += 7;
  }
  return false;
}

void ProtobufBridge::EncodeTag(uint32_t field_number, WireType wire_type, std::vector<uint8_t>& buffer) {
  uint64_t tag = (static_cast<uint64_t>(field_number) << 3) | static_cast<uint64_t>(wire_type);
  EncodeVarint(tag, buffer);
}

bool ProtobufBridge::DecodeTag(const uint8_t*& ptr, const uint8_t* end, uint32_t& field_number, WireType& wire_type) {
  uint64_t tag = 0;
  if (!DecodeVarint(ptr, end, tag)) {
    return false;
  }
  wire_type = static_cast<WireType>(tag & 0x07);
  field_number = static_cast<uint32_t>(tag >> 3);
  return true;
}

std::vector<uint8_t> ProtobufBridge::SerializeFields(const std::vector<ProtobufField>& fields) {
  std::vector<uint8_t> buffer;
  for (const auto& field : fields) {
    EncodeTag(field.field_number, field.wire_type, buffer);
    if (field.wire_type == WireType::Varint && std::holds_alternative<uint64_t>(field.value)) {
      EncodeVarint(std::get<uint64_t>(field.value), buffer);
    } else if (field.wire_type == WireType::LengthDelimited) {
      if (std::holds_alternative<std::string>(field.value)) {
        const auto& str = std::get<std::string>(field.value);
        EncodeVarint(str.size(), buffer);
        buffer.insert(buffer.end(), str.begin(), str.end());
      } else if (std::holds_alternative<std::vector<uint8_t>>(field.value)) {
        const auto& bytes = std::get<std::vector<uint8_t>>(field.value);
        EncodeVarint(bytes.size(), buffer);
        buffer.insert(buffer.end(), bytes.begin(), bytes.end());
      }
    }
  }
  return buffer;
}

bool ProtobufBridge::DeserializeFields(const uint8_t* data, size_t length, std::vector<ProtobufField>& out_fields) {
  const uint8_t* ptr = data;
  const uint8_t* end = data + length;

  while (ptr < end) {
    uint32_t field_num = 0;
    WireType wire_type = WireType::Varint;
    if (!DecodeTag(ptr, end, field_num, wire_type)) {
      return false;
    }

    ProtobufField field;
    field.field_number = field_num;
    field.wire_type = wire_type;

    if (wire_type == WireType::Varint) {
      uint64_t val = 0;
      if (!DecodeVarint(ptr, end, val)) return false;
      field.value = val;
    } else if (wire_type == WireType::LengthDelimited) {
      uint64_t len = 0;
      if (!DecodeVarint(ptr, end, len)) return false;
      if (ptr + len > end) return false;
      std::string str_val(reinterpret_cast<const char*>(ptr), static_cast<size_t>(len));
      ptr += len;
      field.value = str_val;
    } else {
      return false; // Unsupported wire type for compact bridge
    }
    out_fields.push_back(field);
  }
  return true;
}

std::vector<uint8_t> ProtobufBridge::EncodeMethodCall(const std::string& module_name, const std::string& method_name, const std::string& payload) {
  std::vector<ProtobufField> fields = {
    { 1, WireType::LengthDelimited, module_name },
    { 2, WireType::LengthDelimited, method_name },
    { 3, WireType::LengthDelimited, payload }
  };
  return SerializeFields(fields);
}

bool ProtobufBridge::DecodeMethodCall(const uint8_t* data, size_t length, std::string& out_module, std::string& out_method, std::string& out_payload) {
  std::vector<ProtobufField> fields;
  if (!DeserializeFields(data, length, fields)) {
    return false;
  }
  for (const auto& f : fields) {
    if (f.field_number == 1 && std::holds_alternative<std::string>(f.value)) {
      out_module = std::get<std::string>(f.value);
    } else if (f.field_number == 2 && std::holds_alternative<std::string>(f.value)) {
      out_method = std::get<std::string>(f.value);
    } else if (f.field_number == 3 && std::holds_alternative<std::string>(f.value)) {
      out_payload = std::get<std::string>(f.value);
    }
  }
  return !out_module.empty() && !out_method.empty();
}

} // namespace lynxfita
