#include "lynxfita/dma_eib_engine.h"
#include <chrono>
#include <stdexcept>
#include <algorithm>
#include <cstring>
#include <cmath>
#include <cstdint>

#if defined(_WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <malloc.h>
#else
#include <stdlib.h>
#include <sys/mman.h>
#endif

#if defined(__x86_64__) || defined(_M_X64)
#include <immintrin.h>
#endif

namespace lynxfita {

// ============================================================================
// StationaryBuffer Implementation
// ============================================================================

StationaryBuffer::StationaryBuffer(size_t capacity_bytes)
    : data_(nullptr), capacity_(capacity_bytes), is_page_locked_(false) {
  if (capacity_bytes > 0) {
#if defined(_WIN32)
    // 64-byte cache-line aligned allocation on Windows NT
    data_ = static_cast<uint8_t*>(_aligned_malloc(capacity_bytes, 64));
    if (data_) {
      std::memset(data_, 0, capacity_bytes);
      // Attempt to pin / lock pages in physical RAM (ignore error if quota reached)
      is_page_locked_ = (VirtualLock(data_, capacity_bytes) != 0);
    }
#else
    // POSIX 64-byte aligned allocation
    void* ptr = nullptr;
    if (posix_memalign(&ptr, 64, capacity_bytes) == 0) {
      data_ = static_cast<uint8_t*>(ptr);
      std::memset(data_, 0, capacity_bytes);
      is_page_locked_ = (mlock(data_, capacity_bytes) == 0);
    }
#endif
  }
}

StationaryBuffer::~StationaryBuffer() {
  if (data_) {
#if defined(_WIN32)
    if (is_page_locked_) {
      VirtualUnlock(data_, capacity_);
    }
    _aligned_free(data_);
#else
    if (is_page_locked_) {
      munlock(data_, capacity_);
    }
    free(data_);
#endif
    data_ = nullptr;
  }
}

StationaryBuffer::StationaryBuffer(StationaryBuffer&& other) noexcept
    : data_(other.data_), capacity_(other.capacity_), is_page_locked_(other.is_page_locked_) {
  other.data_ = nullptr;
  other.capacity_ = 0;
  other.is_page_locked_ = false;
}

StationaryBuffer& StationaryBuffer::operator=(StationaryBuffer&& other) noexcept {
  if (this != &other) {
    if (data_) {
#if defined(_WIN32)
      if (is_page_locked_) VirtualUnlock(data_, capacity_);
      _aligned_free(data_);
#else
      if (is_page_locked_) munlock(data_, capacity_);
      free(data_);
#endif
    }
    data_ = other.data_;
    capacity_ = other.capacity_;
    is_page_locked_ = other.is_page_locked_;
    other.data_ = nullptr;
    other.capacity_ = 0;
    other.is_page_locked_ = false;
  }
  return *this;
}

bool StationaryBuffer::IsCacheLineAligned() const {
  return data_ != nullptr && (reinterpret_cast<uintptr_t>(data_) % 64 == 0);
}

bool StationaryBuffer::IsPageLocked() const {
  return is_page_locked_;
}

bool StationaryBuffer::Write(size_t offset, const uint8_t* src, size_t length) {
  if (!data_ || !src || offset > capacity_ || length > capacity_ - offset) {
    return false;
  }
  std::memcpy(data_ + offset, src, length);
  return true;
}

bool StationaryBuffer::Read(size_t offset, uint8_t* dest, size_t length) const {
  if (!data_ || !dest || offset > capacity_ || length > capacity_ - offset) {
    return false;
  }
  std::memcpy(dest, data_ + offset, length);
  return true;
}

bool StationaryBuffer::PackSimdVector4f(size_t offset, float x, float y, float z, float w) {
  constexpr size_t kVecBytes = sizeof(float) * 4;
  if (!data_ || offset > capacity_ || kVecBytes > capacity_ - offset) {
    return false;
  }
#if defined(__x86_64__) || defined(_M_X64)
  __m128 vec = _mm_set_ps(w, z, y, x);
  _mm_storeu_ps(reinterpret_cast<float*>(data_ + offset), vec);
#else
  float* target = reinterpret_cast<float*>(data_ + offset);
  target[0] = x;
  target[1] = y;
  target[2] = z;
  target[3] = w;
#endif
  return true;
}

bool StationaryBuffer::UnpackSimdVector4f(size_t offset, float& x, float& y, float& z, float& w) const {
  constexpr size_t kVecBytes = sizeof(float) * 4;
  if (!data_ || offset > capacity_ || kVecBytes > capacity_ - offset) {
    return false;
  }
#if defined(__x86_64__) || defined(_M_X64)
  __m128 vec = _mm_loadu_ps(reinterpret_cast<const float*>(data_ + offset));
  alignas(16) float tmp[4];
  _mm_store_ps(tmp, vec);
  x = tmp[0];
  y = tmp[1];
  z = tmp[2];
  w = tmp[3];
#else
  const float* src = reinterpret_cast<const float*>(data_ + offset);
  x = src[0];
  y = src[1];
  z = src[2];
  w = src[3];
#endif
  return true;
}

bool StationaryBuffer::SimdVectorFmaAdd(size_t src_a_offset, size_t src_b_offset, size_t dst_offset, size_t float_count, float scale) {
  if (!data_) return false;
  if (float_count > capacity_ / sizeof(float)) return false;
  size_t total_bytes = float_count * sizeof(float);
  if (src_a_offset > capacity_ || total_bytes > capacity_ - src_a_offset ||
      src_b_offset > capacity_ || total_bytes > capacity_ - src_b_offset ||
      dst_offset > capacity_ || total_bytes > capacity_ - dst_offset) {
    return false;
  }

  size_t i = 0;
#if defined(__x86_64__) || defined(_M_X64)
  __m128 scale_vec = _mm_set1_ps(scale);
  for (; i + 4 <= float_count; i += 4) {
    __m128 a = _mm_loadu_ps(reinterpret_cast<const float*>(data_ + src_a_offset + i * sizeof(float)));
    __m128 b = _mm_loadu_ps(reinterpret_cast<const float*>(data_ + src_b_offset + i * sizeof(float)));
    __m128 res = _mm_add_ps(a, _mm_mul_ps(b, scale_vec));
    _mm_storeu_ps(reinterpret_cast<float*>(data_ + dst_offset + i * sizeof(float)), res);
  }
#endif
  for (; i < float_count; ++i) {
    float a = *reinterpret_cast<const float*>(data_ + src_a_offset + i * sizeof(float));
    float b = *reinterpret_cast<const float*>(data_ + src_b_offset + i * sizeof(float));
    *reinterpret_cast<float*>(data_ + dst_offset + i * sizeof(float)) = a + b * scale;
  }
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
  if (req.source_offset > cap || req.byte_count > cap - req.source_offset ||
      req.destination_offset > cap || req.byte_count > cap - req.destination_offset) {
    result.error_message = "DMA bounds overflow: transfer exceeds stationary buffer capacity";
    return result;
  }

  // Cell Broadband Engine Element Interconnect Bus (EIB) Dual-Ring Arbitration:
  // 12 nodes on concentric dual-ring bus (Ring0 Clockwise, Ring1 Counter-Clockwise)
  constexpr uint32_t kEibTotalRingNodes = 12;
  uint32_t src_node = static_cast<uint32_t>((req.source_offset / 4096) % kEibTotalRingNodes);
  uint32_t dst_node = static_cast<uint32_t>((req.destination_offset / 4096) % kEibTotalRingNodes);

  uint32_t cw_hops = (dst_node >= src_node) ? (dst_node - src_node) : (kEibTotalRingNodes - src_node + dst_node);
  uint32_t ccw_hops = (src_node >= dst_node) ? (src_node - dst_node) : (kEibTotalRingNodes - dst_node + src_node);

  if (cw_hops <= ccw_hops) {
    result.ring_used = EibRing::Ring0_CW;
    result.ring_hops = (cw_hops == 0) ? 1 : cw_hops;
    ring0_transfers_++;
    ring0_bytes_ += req.byte_count;
  } else {
    result.ring_used = EibRing::Ring1_CCW;
    result.ring_hops = (ccw_hops == 0) ? 1 : ccw_hops;
    ring1_transfers_++;
    ring1_bytes_ += req.byte_count;
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
  if (name == "ring0Transfers") {
    return static_cast<int64_t>(engine_ ? engine_->GetRing0Transfers() : 0);
  }
  if (name == "ring1Transfers") {
    return static_cast<int64_t>(engine_ ? engine_->GetRing1Transfers() : 0);
  }
  if (name == "isCacheLineAligned") {
    return engine_ ? engine_->GetStationaryBuffer().IsCacheLineAligned() : false;
  }
  return false;
}

void StationaryDmaHostObject::SetProperty(const std::string& /*name*/, const JsiValueVariant& /*value*/) {
  // Read-only DMA HostObject interface
}

std::vector<std::string> StationaryDmaHostObject::GetPropertyNames() const {
  return {"capacity", "totalTransfers", "totalBytesTransferred", "ring0Transfers", "ring1Transfers", "isCacheLineAligned", "transfer", "packSimd", "fmaAdd"};
}

static bool ExtractInt64(const JsiValueVariant& v, int64_t& out) {
  if (std::holds_alternative<int64_t>(v)) {
    out = std::get<int64_t>(v);
    return true;
  }
  if (std::holds_alternative<double>(v)) {
    out = static_cast<int64_t>(std::get<double>(v));
    return true;
  }
  return false;
}

static bool ExtractFloat(const JsiValueVariant& v, float& out) {
  if (std::holds_alternative<double>(v)) {
    out = static_cast<float>(std::get<double>(v));
    return true;
  }
  if (std::holds_alternative<int64_t>(v)) {
    out = static_cast<float>(std::get<int64_t>(v));
    return true;
  }
  return false;
}

JsiValueVariant StationaryDmaHostObject::InvokeMethod(const std::string& name, const std::vector<JsiValueVariant>& args) {
  if (name == "transfer" && args.size() >= 4) {
    int64_t ch_id = 0, src_off = 0, dst_off = 0, bytes = 0;
    if (!ExtractInt64(args[0], ch_id) ||
        !ExtractInt64(args[1], src_off) ||
        !ExtractInt64(args[2], dst_off) ||
        !ExtractInt64(args[3], bytes)) {
      return std::string("Error: invalid arguments, expected (channelId, srcOffset, dstOffset, byteCount)");
    }

    DmaTransferRequest req;
    req.channel_id = static_cast<uint32_t>(ch_id);
    req.source_offset = static_cast<uint64_t>(src_off);
    req.destination_offset = static_cast<uint64_t>(dst_off);
    req.byte_count = static_cast<uint32_t>(bytes);
    req.is_simd_vector_aligned = true;

    auto res = engine_->ExecuteTransfer(req);
    if (!res.success) {
      return std::string("DMA transfer failed: ") + res.error_message;
    }
    return std::string("DMA transfer complete: ") + std::to_string(res.bytes_transferred) + " bytes in " + std::to_string(res.transfer_time_ns) + " ns";
  }

  if (name == "packSimd" && args.size() >= 5) {
    int64_t offset = 0;
    float x = 0, y = 0, z = 0, w = 0;
    if (!ExtractInt64(args[0], offset) ||
        !ExtractFloat(args[1], x) ||
        !ExtractFloat(args[2], y) ||
        !ExtractFloat(args[3], z) ||
        !ExtractFloat(args[4], w)) {
      return false;
    }
    return engine_->GetStationaryBuffer().PackSimdVector4f(static_cast<size_t>(offset), x, y, z, w);
  }

  if (name == "fmaAdd" && args.size() >= 5) {
    int64_t a_off = 0, b_off = 0, dst_off = 0, count = 0;
    float scale = 0;
    if (!ExtractInt64(args[0], a_off) ||
        !ExtractInt64(args[1], b_off) ||
        !ExtractInt64(args[2], dst_off) ||
        !ExtractInt64(args[3], count) ||
        !ExtractFloat(args[4], scale)) {
      return false;
    }
    return engine_->GetStationaryBuffer().SimdVectorFmaAdd(
        static_cast<size_t>(a_off), static_cast<size_t>(b_off), static_cast<size_t>(dst_off),
        static_cast<size_t>(count), scale);
  }

  return false;
}

} // namespace lynxfita
