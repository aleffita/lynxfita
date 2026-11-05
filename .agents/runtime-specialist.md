---
type: profile
title: "Runtime Specialist — Endogenous Cordis Spine, Static Hermes AOT/JIT, Cross-Platform Native FFI & WIT/WASI"
description: "Operational profile for native C++20/Static Hermes runtime engineering, Cordis Context/Service/Fiber integration, dynamic library loading (.dll/.so/.dylib), and Stationary DMA."
tags:
  - runtime-specialist
  - cordis
  - static-hermes
  - jsi
  - wit-wasi
  - dma
timestamp: 2026-11-05
status: active
author: aleffita
---

# Runtime Specialist Profile

## Scope & Ownership
Owns [`src/native/`](file:///j:/limiar/packages/lynxfita/src/native), [`packages/core/`](file:///j:/limiar/packages/lynxfita/packages/core), [`packages/codegen/`](file:///j:/limiar/packages/lynxfita/packages/codegen), and [`packages/wasi-runtime/`](file:///j:/limiar/packages/lynxfita/packages/wasi-runtime).

## Core Engineering Mandates
1. **Endogenous Cordis Spine (arXiv:2608.25512)**:
   - Every capability in C++20 (`lynxfita::cordis::NativeContext`) and TypeScript (`LynxFitaContext`) is mounted as a Cordis `Service` (`ctx.dma`, `ctx.protobuf`, `ctx.compiler`, `ctx.ffi`, `ctx.wasi`, `ctx.gpu`).
   - All resource allocations (DMA slots, dynamic library handles, WASI memory views, bytecode buffers) MUST register a revertible disposer via `ctx.effect()` / generator `yield` that unwinds in LIFO order when the owning Fiber unloads.
2. **Cross-Platform Dynamic Native Library Loader (`ctx.ffi`)**:
   - Replaces Lynx's experimental `LynxNodeAPI.cc` (`vendor/lynx/explorer/cpp/LynxNodeAPI.cc`) with zero-Node-API JSI + Stationary DMA bindings.
   - Uses `LoadLibraryExW` / `GetProcAddress` / `FreeLibrary` on Windows and `dlopen` / `dlsym` / `dlclose` on Linux/macOS/Android.
   - Automatically invokes `FreeLibrary` / `dlclose` on Cordis Fiber `_unload()`.
3. **WIT (WebAssembly Interface Types) Universal Module IR (`ctx.wasi` & `@lynxfita/codegen`)**:
   - WebAssembly is not merely a security sandbox; WIT interface specifications serve as the universal Intermediate Representation (IR) for `@lynxfita/codegen` to synthesize typed Cordis `Service` definitions, JSI `HostObject` headers, and Stationary DMA offset layouts that bind seamlessly to either `.wasm` modules or native `.dll`/`.so`/`.dylib` libraries.
4. **Statistical Verification**:
   - All runtime paths are verified via `lynxfita_native_tests` and benchmarked statistically under `benchmarks/` following Kalibera & Jones ($N \ge 30$ samples, warm-up convergence, $p50/p95/p99$, IQR, CV%, 95% CI).
