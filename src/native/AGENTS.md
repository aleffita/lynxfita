---
type: protocol
title: Native C++ Engine Domain Agentry Indexer
description: Governance, build standards, and verification protocols for LynxFita's native C++20 JSI adapter and WASI host layer.
tags:
  - agentry
  - native
  - cpp20
  - jsi
  - indexer
timestamp: 2026-11-04
status: active
author: aleffita
---

# Native C++ Engine Domain Agentry Indexer

## 1. Domain Governance
This domain contains the high-performance native C++20 layer bridging JavaScript engines (Hermes StaticH, PrimJS) and native platform APIs.

### Component Structure
- [`src/native/include/lynxfita/`](file:///j:/limiar/packages/lynxfita/src/native/include/lynxfita):
  - `jsi_types.h`: `HostObject`, `JsiValueVariant`, `StatusCode`, `ExecutionResult`, and `JsiValueToString`.
  - `hermes_runtime_adapter.h`: Hermes AOT/JIT lifecycle and bytecode verification (`\x1fHBC`).
  - `legacy_bridge_interceptor.h`: Coexistence bridge sequestrator intercepting `spkPipe` with `std::shared_mutex` concurrency protection.
  - `wasi_host_module.h`: Sandboxed WASI host module with linear memory bounds enforcement (`WriteMemory`, `ReadMemory`, `GrowMemory`).
- [`src/native/include/lynxfita/generated/`](file:///j:/limiar/packages/lynxfita/src/native/include/lynxfita/generated):
  - Auto-generated C++ spec headers output by `@lynxfita/codegen`.
- [`src/native/tests/test_runner.cc`](file:///j:/limiar/packages/lynxfita/src/native/tests/test_runner.cc):
  - Test runner verifying runtime initialization, generated spec compilation, WASI memory boundaries, JSI vs JSON benchmarks, and multithreaded mutation safety.

## 2. Invariants for Native Developers
1. **Modern C++20 Standard**: Compile with `set(CMAKE_CXX_STANDARD 20)` under MSVC (VS 2026 Developer Command Prompt) + Ninja.
2. **Deterministic Memory Safety**: All linear memory accesses must be bounds-checked against `capabilities_.memory_limit_bytes`.
3. **Thread Safety**: Any mutable registry accessed across JSI calls must be protected with reader/writer locks (`std::shared_mutex`).
4. **Comprehensive Variant Serialization**: Ensure all `JsiValueVariant` types (`double`, `int64_t`, `bool`, `string`, `vector<uint8_t>`) are serialized via `JsiValueToString`.
