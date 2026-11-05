---
type: protocol
title: "AGENTS.md — Native C++20 Engine, Dynamic Shared Libraries & Static Hermes"
description: "Governance rules for C++20 native runtime components, NativeContext Cordis spine, LoadLibraryExW/dlopen FFI, and Stationary DMA."
tags:
  - native
  - cpp20
  - cordis
  - static-hermes
  - dynamic-library
  - dma
timestamp: 2026-11-05
status: active
author: aleffita
---

# AGENTS.md — Native C++20 Engine (`src/native/`)

This directory contains the C++20 native runtime engine (`lynxfita_native_core`), the dynamically loaded shared library plugin (`lynxfita_weather_simd_plugin` `.dll`/`.so`/`.dylib`), the multi-platform native host (`lynxfita_explorer`), and the C++20 verification and benchmark binaries (`lynxfita_native_tests`, `lynxfita_bench`).

## Core Native Subsystems

1. **`lynxfita::cordis::NativeContext` (`cordis_native_context.h` / `.cc`)**:
   - Native C++20 realization of the Cordis `Context` and `Fiber` lifecycle (arXiv:2608.25512) inside the Static Hermes / JSI runtime.
   - Tracks native service registrations (`dma`, `protobuf`, `compiler`, `ffi`, `wasi`) and executes LIFO disposers when a Fiber unloads.
2. **Cross-Platform Dynamic Native Library Loader (`native_ffi_loader.h` / `.cc`)**:
   - Supersedes `vendor/lynx/explorer/cpp/LynxNodeAPI.cc`.
   - Loads `.dll` via `LoadLibraryExW` / `GetProcAddress` on Windows and `.so` / `.dylib` via `dlopen` / `dlsym` on Linux/macOS/Android.
   - Binds exported C ABI plugin functions directly to Stationary DMA slots (`0x2000`) and invokes `FreeLibrary` / `dlclose` automatically when the owning Cordis Fiber unloads.
3. **Stationary DMA Arena & SIMD (`dma_eib_engine.h` / `.cc`)**:
   - 64-byte cache-line aligned stationary memory (`_aligned_malloc` / `std::aligned_alloc`), lock-free SPSC ring lanes, and SSE/AVX/NEON vector reductions.
4. **Native Coroutine Scheduler (`coroutine_scheduler.h` / `.cc`)**:
   - C++20 `<coroutine>` symmetric/yieldable fibers scheduled without GIL contention.
5. **Static Hermes AOT/JIT Adapter (`hermes_runtime_adapter.cc`, `hermes_compiler.cc`)**:
   - Verifies `.hbc` headers, SHA-256 digests, and Ed25519 signatures, and supports runtime bytecode compilation for federated OTA bundles.
