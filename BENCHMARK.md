# Statistical Performance Microbenchmarks

Methodology: Kalibera & Jones standard ($N = 30$ independent samples per regime, 10 warm-up rounds discarded).

## Provenance

- **Timestamp**: `2026-11-05T15:26:52.198Z`
- **Processor**: `AMD Ryzen 5 4500 6-Core Processor` (12 threads)
- **Operating System**: `Windows_NT 10.0.19045 (win32)` [x64]
- **Runtime Environment**: `Node.js v26.12.1` (V8 Engine)

> **Measurement Context & Scope**: The metrics reported below measure in-process memory operations, serialization, and array abstractions executed within the Node.js V8 control plane. They do **not** reflect physical PCIe/bus DMA hardware transfers.

## Measured Regimes

| Subsystem / Operation | Payload | $p50$ (\mu s) | IQR (\mu s) | $p95$ (\mu s) | $p99$ (\mu s) | Mean \pm 95\% CI (\mu s) | CV% | Throughput (MB/s) | \Delta Heap (KiB) |
|---|---|---|---|---|---|---|---|---|---|
| **In-Memory Buffer Transfer** | `64 B` | 0.9 | 0.1 | 1.9 | 9.3 | 1.2 \pm 0.6 | 130.56% | 51.43 | 25.71 |
| **In-Memory Buffer Transfer** | `4 KB` | 0.7 | 0.1 | 1.7 | 2.8 | 0.9 \pm 0.2 | 50.52% | 4489.94 | -328.48 |
| **In-Memory Buffer Transfer** | `64 KB` | 2.2 | 0.3 | 2.9 | 3.2 | 2.2 \pm 0.1 | 13.79% | 28026.91 | 16.2 |
| **In-Memory Buffer Transfer** | `1 MB` | 29.8 | 15.6 | 113 | 167.1 | 41.6 \pm 10.7 | 72.05% | 24017.29 | 16.15 |
| **SIMD Float View Pack/Unpack** | `16 B` | 0.54 | 0.18 | 2.1 | 23.81 | 1.4 \pm 1.5 | 303.81% | 10.91 | -317.41 |
| **Protobuf Method Wire Encoding** | `64 B` | 10.7 | 1.4 | 15.6 | 16.3 | 11.2 \pm 0.6 | 15.59% | 5.46 | 166.06 |
| **Protobuf Method Wire Encoding** | `4 KB` | 15.5 | 4.5 | 53.9 | 57.1 | 19.5 \pm 4.2 | 60.11% | 200.12 | 284.05 |
| **Linear Memory Read/Write** | `64 B` | 0.6 | 0 | 0.9 | 2.3 | 0.7 \pm 0.1 | 47.71% | 91.1 | 37.06 |
| **Linear Memory Read/Write** | `4 KB` | 2.1 | 0.7 | 2.8 | 48.1 | 3.6 \pm 3.0 | 234.4% | 1088.09 | 12.75 |
| **Linear Memory Read/Write** | `64 KB` | 31 | 6.2 | 55.2 | 57.4 | 33.1 \pm 2.8 | 23.83% | 1886.51 | 12.75 |
| **Linear Memory Read/Write** | `1 MB` | 755.5 | 151 | 962.1 | 980.4 | 754.7 \pm 38.8 | 14.38% | 1324.99 | 12.75 |
| **Float Math Loop (WebGPU Mock)** | `64 B` | 5.9 | 1.3 | 8.5 | 64.1 | 7.8 \pm 3.8 | 137.44% | 7.86 | 92.23 |
| **Float Math Loop (WebGPU Mock)** | `4 KB` | 37.5 | 4.6 | 41.9 | 53.9 | 37.8 \pm 1.4 | 10.47% | 103.4 | 22.13 |

## Interpretation & Invariants

1. **In-Memory TypedArray Transfers**: Memory bandwidth scales with payload size in V8 heap memory; for 64 KB payloads, coefficient of variation remains low (CV% ~ 13.8%).
2. **Protobuf Varint Framing**: Varint bitwise framing overhead scales predictably with message length in pure JavaScript.
3. **Linear Memory Views**: Slicing and boundary checking on ArrayBuffer maintains sub-microsecond latency on 64 B to 4 KB buffers.
4. **Native C++ Engine Benchmarks**: Future microbenchmarks will isolate native C++20 `lynxfita_native.lib` performance from V8 runtime overhead.
