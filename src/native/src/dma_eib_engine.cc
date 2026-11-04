#include "lynxfita/dma_eib_engine.h"
#include <chrono>
#include <stdexcept>
#include <algorithm>

namespace lynxfita {

// ============================================================================
// StationaryBuffer Implementation
// ============================================================================

StationaryBuffer::StationaryBuffer(size_t capacity_bytes)
    : data_(nullptr), capacity_(capacity_bytes) {
  if (capacity_bytes > 0) {
    data_ = new (std::nothrow) uint8_t[capacity_bytes];
    if (data_) {
      std::memset(data_, 0, capacity_bytes);
    }
  }
}

StationaryBuffer::~StationaryBuffer() {
  delete[] data_;
  data_ = nullptr;
}

StationaryBuffer::StationaryBuffer(StationaryBuffer&& other) noexcept
    : data_(other.data_), capacity_(other.capacity_) {
  other.data_ = nullptr;
  other.capacity_ = 0;
}

StationaryBuffer& StationaryBuffer::operator=(StationaryBuffer&& other) noexcept {
  if (this != &other) {
    delete[] data_;
    data_ = other.data_;
    capacity_ = other.capacity_;
    other.data_ = nullptr;
    other.capacity_ = 0;
  }
  return *this;
}

bool StationaryBuffer::Write(size_t offset, const uint8_t* src, size_t length) {
  if (!data_ || !src || (offset + length > capacity_)) {
    return false;
  }
  std::memcpy(data_ + offset, src, length);
  return true;
}

bool StationaryBuffer::Read(size_t offset, uint8_t* dest, size_t length) const {
  if (!data_ || !dest || (offset + length > capacity_)) {
    return false;
  }
  std::memcpy(dest, data_ + offset, length);
  return true;
}

bool StationaryBuffer::PackSimdVector4f(size_t offset, float x, float y, float z, float w) {
  if (offset + sizeof(float) * 4 > capacity_) {
    return false;
  }
  float* target = reinterpret_cast<float*>(data_ + offset);
  target[0] = x;
  target[1] = y;
  target[2] = z;
  target[3] = w;
  return true;
}

bool StationaryBuffer::UnpackSimdVector4f(size_t offset, float& x, float& y, float& z, float& w) const {
  if (offset + sizeof(float) * 4 > capacity_) {
    return false;
  }
  const float* src = reinterpret_cast<const float*>(data_ + offset);
  x = src[0];
  y = src[1];
  z = src[2];
  w = src[3];
  return true;
}

// ============================================================================
// DmaChannel Implementation
// ============================================================================

DmaChannel::DmaChannel(uint32_t channel_id, DmaLaneDirection direction, size_t queue_depth)
    : channel_id_(channel_id), direction_(direction), queue_depth_(queue_depth),
      ring_buffer_(queue_depth) {}

bool DmaChannel::EnqueueTransfer(const DmaTransferRequest& req) {
  std::lock_guard<std::mutex> lock(queue_mutex_);
  if (count_ >= queue_depth_) {
    return false; // Ring buffer full
  }
  ring_buffer_[tail_] = req;
  tail_ = (tail_ + 1) % queue_depth_;
  count_++;
  return true;
}

bool DmaChannel::DequeueTransfer(DmaTransferRequest& req) {
  std::lock_guard<std::mutex> lock(queue_mutex_);
  if (count_ == 0) {
    return false; // Ring buffer empty
  }
  req = ring_buffer_[head_];
  head_ = (head_ + 1) % queue_depth_;
  count_--;
  return true;
}

size_t DmaChannel::PendingTransfers() const {
  std::lock_guard<std::mutex> lock(queue_mutex_);
  return count_;
}

// ============================================================================
// DmaEibEngine Implementation
// ============================================================================

DmaEibEngine::DmaEibEngine(size_t arena_size)
    : stationary_buffer_(std::make_unique<StationaryBuffer>(arena_size)) {}

DmaEibEngine::~DmaEibEngine() = default;

bool DmaEibEngine::CreateChannel(uint32_t channel_id, DmaLaneDirection direction) {
  std::lock_guard<std::mutex> lock(channels_mutex_);
  for (const auto& ch : channels_) {
    if (ch->GetId() == channel_id) {
      return false; // Channel already exists
    }
  }
  channels_.push_back(std::make_shared<DmaChannel>(channel_id, direction));
  return true;
}

std::shared_ptr<DmaChannel> DmaEibEngine::GetChannel(uint32_t channel_id) {
  std::lock_guard<std::mutex> lock(channels_mutex_);
  for (const auto& ch : channels_) {
    if (ch->GetId() == channel_id) {
      return ch;
    }
  }
  return nullptr;
}

DmaTransferResult DmaEibEngine::ExecuteTransfer(const DmaTransferRequest& req) {
  auto start_time = std::chrono::steady_clock::now();

  DmaTransferResult result;
  result.success = false;
  result.bytes_transferred = 0;
  result.transfer_time_ns = 0;

  if (!stationary_buffer_ || !stationary_buffer_->Data()) {
    result.error_message = "Stationary memory arena not initialized";
    return result;
  }

  size_t cap = stationary_buffer_->Capacity();
  if (req.source_offset + req.byte_count > cap || req.destination_offset + req.byte_count > cap) {
    result.error_message = "DMA bounds overflow: transfer exceeds stationary buffer capacity";
    return result;
  }

  uint8_t* base = stationary_buffer_->Data();
  // Perform zero-copy in-place memory move across stationary buffer lanes
  std::memmove(base + req.destination_offset, base + req.source_offset, req.byte_count);

  auto end_time = std::chrono::steady_clock::now();
  result.success = true;
  result.bytes_transferred = req.byte_count;
  result.transfer_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(end_time - start_time).count();

  total_transfers_++;
  total_bytes_transferred_ += req.byte_count;
  return result;
}

// ============================================================================
// StationaryDmaHostObject Implementation
// ============================================================================

StationaryDmaHostObject::StationaryDmaHostObject(std::shared_ptr<DmaEibEngine> engine)
    : engine_(std::move(engine)) {}

JsiValueVariant StationaryDmaHostObject::GetProperty(const std::string& name) {
  if (name == "capacity") {
    return static_cast<int64_t>(engine_ ? engine_->GetStationaryBuffer().Capacity() : 0);
  }
  if (name == "totalTransfers") {
    return static_cast<int64_t>(engine_ ? engine_->GetTotalTransfers() : 0);
  }
  if (name == "totalBytesTransferred") {
    return static_cast<int64_t>(engine_ ? engine_->GetTotalBytesTransferred() : 0);
  }
  return false;
}

void StationaryDmaHostObject::SetProperty(const std::string& /*name*/, const JsiValueVariant& /*value*/) {
  // Read-only DMA HostObject interface
}

std::vector<std::string> StationaryDmaHostObject::GetPropertyNames() const {
  return {"capacity", "totalTransfers", "totalBytesTransferred", "transfer", "packSimd"};
}

JsiValueVariant StationaryDmaHostObject::InvokeMethod(const std::string& name, const std::vector<JsiValueVariant>& args) {
  if (name == "transfer" && args.size() >= 4) {
    if (!std::holds_alternative<int64_t>(args[0]) ||
        !std::holds_alternative<int64_t>(args[1]) ||
        !std::holds_alternative<int64_t>(args[2]) ||
        !std::holds_alternative<int64_t>(args[3])) {
      return std::string("Error: invalid arguments, expected (channelId, srcOffset, dstOffset, byteCount)");
    }

    DmaTransferRequest req;
    req.channel_id = static_cast<uint32_t>(std::get<int64_t>(args[0]));
    req.source_offset = static_cast<uint64_t>(std::get<int64_t>(args[1]));
    req.destination_offset = static_cast<uint64_t>(std::get<int64_t>(args[2]));
    req.byte_count = static_cast<uint32_t>(std::get<int64_t>(args[3]));
    req.is_simd_vector_aligned = true;

    auto res = engine_->ExecuteTransfer(req);
    if (!res.success) {
      return std::string("DMA transfer failed: ") + res.error_message;
    }
    return std::string("DMA transfer complete: ") + std::to_string(res.bytes_transferred) + " bytes in " + std::to_string(res.transfer_time_ns) + " ns";
  }

  if (name == "packSimd" && args.size() >= 5) {
    size_t offset = static_cast<size_t>(std::get<int64_t>(args[0]));
    float x = static_cast<float>(std::holds_alternative<double>(args[1]) ? std::get<double>(args[1]) : std::get<int64_t>(args[1]));
    float y = static_cast<float>(std::holds_alternative<double>(args[2]) ? std::get<double>(args[2]) : std::get<int64_t>(args[2]));
    float z = static_cast<float>(std::holds_alternative<double>(args[3]) ? std::get<double>(args[3]) : std::get<int64_t>(args[3]));
    float w = static_cast<float>(std::holds_alternative<double>(args[4]) ? std::get<double>(args[4]) : std::get<int64_t>(args[4]));
    return engine_->GetStationaryBuffer().PackSimdVector4f(offset, x, y, z, w);
  }

  return false;
}

} // namespace lynxfita
