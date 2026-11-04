#pragma once

#include "lynxfita/jsi_types.h"
#include <vector>
#include <memory>
#include <string>
#include <atomic>
#include <mutex>
#include <cstdint>
#include <cstring>

namespace lynxfita {

// Maximum size for a stationary memory arena (16 MB by default)
constexpr size_t kDefaultStationaryArenaSize = 16 * 1024 * 1024;
// Maximum packets in a circular DMA ring
constexpr size_t kDmaRingCapacity = 1024;

enum class DmaLaneDirection {
  HostToWorker, // PPE to SPE
  WorkerToHost, // SPE to PPE
  Bidirectional
};

struct DmaTransferRequest {
  uint32_t channel_id;
  uint64_t source_offset;
  uint64_t destination_offset;
  uint32_t byte_count;
  bool is_simd_vector_aligned;
};

struct DmaTransferResult {
  bool success;
  uint32_t bytes_transferred;
  uint64_t transfer_time_ns;
  std::string error_message;
};

// Pinned Stationary Buffer that never moves in physical/virtual memory
class StationaryBuffer {
 public:
  explicit StationaryBuffer(size_t capacity_bytes);
  ~StationaryBuffer();

  // Non-copyable, movable
  StationaryBuffer(const StationaryBuffer&) = delete;
  StationaryBuffer& operator=(const StationaryBuffer&) = delete;
  StationaryBuffer(StationaryBuffer&& other) noexcept;
  StationaryBuffer& operator=(StationaryBuffer&& other) noexcept;

  bool Write(size_t offset, const uint8_t* src, size_t length);
  bool Read(size_t offset, uint8_t* dest, size_t length) const;
  uint8_t* Data() { return data_; }
  const uint8_t* Data() const { return data_; }
  size_t Capacity() const { return capacity_; }

  // SIMD 128-bit / 256-bit Vector packing helpers
  bool PackSimdVector4f(size_t offset, float x, float y, float z, float w);
  bool UnpackSimdVector4f(size_t offset, float& x, float& y, float& z, float& w) const;

 private:
  uint8_t* data_;
  size_t capacity_;
};

// Bidirectional DMA Channel (EIB Lane)
class DmaChannel {
 public:
  DmaChannel(uint32_t channel_id, DmaLaneDirection direction, size_t queue_depth = kDmaRingCapacity);
  ~DmaChannel() = default;

  uint32_t GetId() const { return channel_id_; }
  DmaLaneDirection GetDirection() const { return direction_; }

  bool EnqueueTransfer(const DmaTransferRequest& req);
  bool DequeueTransfer(DmaTransferRequest& req);
  size_t PendingTransfers() const;

 private:
  uint32_t channel_id_;
  DmaLaneDirection direction_;
  size_t queue_depth_;
  std::vector<DmaTransferRequest> ring_buffer_;
  mutable std::mutex queue_mutex_;
  size_t head_{0};
  size_t tail_{0};
  size_t count_{0};
};

// Element Interconnect Bus (EIB) DMA Coordinator
// Manages stationary memory arenas and DMA communication across PPE (controller) and SPEs (workers)
class DmaEibEngine {
 public:
  explicit DmaEibEngine(size_t arena_size = kDefaultStationaryArenaSize);
  ~DmaEibEngine();

  // Channel & Lane Management
  bool CreateChannel(uint32_t channel_id, DmaLaneDirection direction);
  std::shared_ptr<DmaChannel> GetChannel(uint32_t channel_id);

  // Synchronous & Asynchronous DMA Transfer execution
  DmaTransferResult ExecuteTransfer(const DmaTransferRequest& req);

  // Stationary buffer access
  StationaryBuffer& GetStationaryBuffer() { return *stationary_buffer_; }
  const StationaryBuffer& GetStationaryBuffer() const { return *stationary_buffer_; }

  // Statistics
  uint64_t GetTotalTransfers() const { return total_transfers_.load(); }
  uint64_t GetTotalBytesTransferred() const { return total_bytes_transferred_.load(); }

 private:
  std::unique_ptr<StationaryBuffer> stationary_buffer_;
  std::vector<std::shared_ptr<DmaChannel>> channels_;
  mutable std::mutex channels_mutex_;
  std::atomic<uint64_t> total_transfers_{0};
  std::atomic<uint64_t> total_bytes_transferred_{0};
};

// JSI HostObject for exposing Stationary DMA to JavaScript / Hermes
class StationaryDmaHostObject : public HostObject {
 public:
  explicit StationaryDmaHostObject(std::shared_ptr<DmaEibEngine> engine);
  ~StationaryDmaHostObject() override = default;

  std::string GetName() const override { return "StationaryDMA"; }
  JsiValueVariant GetProperty(const std::string& name) override;
  void SetProperty(const std::string& name, const JsiValueVariant& value) override;
  std::vector<std::string> GetPropertyNames() const override;
  JsiValueVariant InvokeMethod(const std::string& name, const std::vector<JsiValueVariant>& args) override;

 private:
  std::shared_ptr<DmaEibEngine> engine_;
};

} // namespace lynxfita
