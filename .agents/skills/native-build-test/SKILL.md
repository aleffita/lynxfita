---
name: native-build-test
description: Procedures for compiling the native C++20 JSI adapter and executing the LynxFita native test suite on Windows.
---

# Native Build & Test Skill

## When to Use
Use when:
- Modifying C++ code in `src/native/` (`hermes_runtime_adapter`, `legacy_bridge_interceptor`, `wasi_host_module`, `jsi_types.h`).
- Adding new native test scenarios to `src/native/tests/test_runner.cc`.
- Benchmarking Direct JSI execution latency against JSON bridge serialization.

## Build Environment
- **Compiler**: MSVC 19.51 (Visual Studio 2026 Developer Command Prompt).
- **Generator**: Ninja via CMake 3.20+.
- **Standard**: C++20 (`/std:c++20`).

## Command Protocols
- **Build and Run Suite**:
  ```powershell
  pnpm run test:native
  ```
- **Direct Script Invocation**:
  ```cmd
  scripts\test-native.cmd
  ```

## Verification Checklist
- `TestHermesRuntimeAdapter`: Bytecode magic signature `\x1fHBC` verification.
- `TestCodegenNativeModule`: Spec compilation and typed dynamic dispatch.
- `TestLegacyBridgeInterceptor`: Direct JSI and legacy JSON fallback path.
- `TestWasiHostModule`: WASM magic bytes, linear memory read/write, sandbox limit trap.
- `TestBridgePerformanceBenchmark`: JSI vs JSON nanoseconds per operation throughput.
- `TestThreadSafety`: Concurrent dispatches and registrations under `std::shared_mutex`.
