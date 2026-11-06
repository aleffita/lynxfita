---
type: doc
title: Cordis Endogenous Runtime Primer
description: Reference for Cordis capability seams, Context injection, Fiber isolation, and revertible effects across TypeScript and C++20 in LynxFita.
tags:
  - cordis
  - architecture
  - capability-seam
  - jsi
  - fiber
timestamp: 2026-11-05
status: active
author: aleffita
---

# Cordis Endogenous Runtime Primer

LynxFita uses [Cordis](https://github.com/shigma/cordis) ([`vendor/cordis`](../vendor/cordis), [arXiv:2608.25512](https://arxiv.org/abs/2608.25512)) as its endogenous runtime spine across both the TypeScript control plane (`LynxFitaContext`) and the C++20 native engine (`lynxfita::cordis::NativeContext`). Every runtime capability is mounted as a Cordis **Service** with explicit `inject` coeffects and revertible `ctx.effect()` disposers.

```mermaid
flowchart TD
    classDef core fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4
    classDef memory fill:#1e1e2e,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4
    classDef ffi fill:#1e1e2e,stroke:#fab387,stroke-width:2px,color:#cdd6f4
    classDef security fill:#1e1e2e,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4
    classDef wire fill:#1e1e2e,stroke:#f9e2af,stroke-width:2px,color:#cdd6f4

    subgraph Context["Unified Cordis Context (LynxFitaContext / NativeContext)"]
        Spine["Cordis Root Context (Fiber Tree)"]:::core
        DmaService["ctx.dma (Stationary DMA Arena 0x2000)"]:::memory
        CompilerService["ctx.compiler (Hermes Bytecode AOT / JSI)"]:::core
        FfiService["ctx.ffi & ctx.wasi (Dynamic Plugins / WASI)"]:::ffi
        ProtobufService["ctx.protobuf (Zero-JSON Wire Framing)"]:::wire
        UpdaterService["ctx.updater (Ed25519 Provenance & OTA)"]:::security
    end

    Spine --> DmaService
    Spine --> CompilerService
    Spine --> FfiService
    Spine --> ProtobufService
    Spine --> UpdaterService
    CompilerService <-->|JSI HostObject Bridge| DmaService
    FfiService <-->|Vectorized Compute| DmaService
    ProtobufService <-->|Wire Framing Slots| DmaService
    UpdaterService -->|Disposer on Signature Mismatch| Spine
```

Interactive viewer: [`docs/architecture/cordis-spine.html`](architecture/cordis-spine.html)

---

## 1. Capability Seam Anatomy

Every capability in LynxFita follows a three-part seam contract:

1. **Service Key & Contract**: Declares the typed property on `Context` (for example `ctx.dma`, `ctx.compiler`, `ctx.ffi`, `ctx.wasi`, `ctx.updater`, `ctx.federation`).
2. **Service Provider (`Service` subclass)**: Owns the lifecycle of the underlying resource (a 64-byte-aligned Stationary DMA arena, an Ed25519 digital signature verifier, or a `LoadLibraryExW` / `dlopen` native handle) and registers teardown hooks via `this.ctx.effect()`.
3. **Consumer Plugin**: Declares required upstream services via `static inject = ['dma', 'compiler']` and runs only after all injected dependencies are active in the current `Fiber`.

```ts
import { LynxFitaContext, Service } from '@lynxfita/core';

export class WeatherSimdConsumer extends Service {
  static override readonly inject = ['dma', 'ffi', 'gpu'] as const;

  constructor(ctx: LynxFitaContext) {
    super(ctx, 'weatherSimd');
    this.ctx.effect(() => {
      const slot = this.ctx.dma.allocateSlot(0x2000, 1024);
      return () => this.ctx.dma.releaseSlot(slot);
    });
  }
}
```

---

## 2. Mounted Capability Seams

| Service Key | TypeScript Provider (`packages/`) | C++20 Provider (`src/native/`) | Responsibility |
| :--- | :--- | :--- | :--- |
| `ctx.dma` | `DmaService` (`@lynxfita/core`) | `NativeDmaService` (`stationary_dma.cc`) | 64-byte-aligned Stationary DMA arena (`0x0000` telemetry, `0x1000` Protobuf wire, `0x2000` weather & shader uniforms), PPE/SPE ring lanes, SIMD reductions. |
| `ctx.protobuf` | `ProtobufService` (`@lynxfita/core`) | `NativeProtobufService` (`protobuf_frame.cc`) | Zero-JSON binary wire framing (`tag << 3 \| wire_type`) over `ctx.dma`. |
| `ctx.compiler` | `CompilerService` (`@lynxfita/core`) | `NativeCompilerService` (`hermes_compiler.cc`) | Static Hermes ahead-of-time (`.hbc`) and runtime JIT/AOT compilation + register/stack VM execution. |
| `ctx.ffi` | `FfiService` (`@lynxfita/codegen`) | `NativeFfiLoader` (`native_ffi_loader.cc`) | Cross-platform shared library loader (`LoadLibraryExW` on Windows, `dlopen` on Linux/macOS) with automatic `FreeLibrary`/`dlclose` on Fiber unload. |
| `ctx.wasi` | `WasiService` (`@lynxfita/wasi-runtime`) | `WasiHostModule` (`wasi_host_module.cc`) | WIT (WebAssembly Interface Types) universal module IR and LEB128 Wasm binary interpreter over `ctx.dma`. |
| `ctx.gpu` | `WebGpuService` (`@lynxfita/core`) | — | W3C WebGPU two-buffer staging, WGSL compute shaders, and `huggingface/kernels` catalog dispatch. |
| `ctx.federation` | `FederationService` (`@lynxfita/updater`) | — | Reconciles embedded installation bundles vs. remote federated bundles using Ed25519 signatures and SHA-256 payload integrity verification, with deterministic rollback on mismatch. |
| `ctx.router` | `ExplorerRouterService` (`examples/explorer`) | — | Application scheme router (`lynxfita://miniapp/<id>`) launching isolated Fibers. |

---

## 3. Revertible Effects & Deterministic Baseline Rollback

All resource registrations inside an application container execute inside an isolated Cordis `Fiber` (`ctx.isolate()`). When an application unloads—or when `ctx.federation` encounters an invalid/tampered Ed25519 digital signature or SHA-256 mismatch—`ctx.federation` invokes `remoteFiber._unload()`:

1. `ctx.gpu` releases WebGPU staging buffers.
2. `ctx.wasi` unmaps linear memory views bound to `ctx.dma`.
3. `ctx.ffi` calls `FreeLibrary` (Windows) or `dlclose` (POSIX) on native `.dll`/`.so`/`.dylib` handles.
4. `ctx.dma` zeroes and returns Stationary DMA slots (`0x2000`) to the arena allocator.
5. `ctx.federation` mounts the verified embedded installation baseline bundle without dropping the Explorer host process.

