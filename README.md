<div align="center">

# LynxFita

**Self-Contained Native Desktop Application Runtime for LynxJS**

*Static Hermes (`static_h`) &bull; C++20 JSI Engine & Dynamic FFI &bull; WIT/WASI Components &bull; 64B Stationary DMA &bull; Ed25519 Release Integrity*

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI Status](https://github.com/aleffita/lynxfita/actions/workflows/ci.yml/badge.svg)](https://github.com/aleffita/lynxfita/actions)
[![C++20](https://img.shields.io/badge/C%2B%2B-20-00599C?logo=c%2B%2B)](https://en.cppreference.com/w/cpp/20)
[![pnpm workspace](https://img.shields.io/badge/pnpm-workspace-orange?logo=pnpm)](https://pnpm.io/)
[![Static Hermes](https://img.shields.io/badge/Hermes-static__h-0081FB?logo=meta)](https://github.com/meta/hermes/tree/static_h)
[![Cordis](https://img.shields.io/badge/Cordis-arXiv%3A2608.25512-00A88F)](https://arxiv.org/abs/2608.25512)
[![Sponsor](https://img.shields.io/badge/Sponsor-FitaLabs-635BFF?logo=stripe&logoColor=white)](https://donate.stripe.com/9B66oHaordEdf36erNfEk00)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub_Sponsors-♥_aleffita-EA4AAA?logo=githubsponsors)](https://github.com/sponsors/aleffita)

<br />

<picture>
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/cordis-spine-light.png" />
  <img src="docs/assets/cordis-spine-dark.png" alt="LynxFita Endogenous Cordis Runtime Spine" width="100%" />
</picture>

</div>

---

## 1. Overview & Self-Contained Desktop Architecture

**LynxFita** replaces Lynxtron (`vendor/lynxtron`) and the heavy Node.js + IPC JSON bridge in LynxJS desktop hosts with a unified, self-contained desktop runtime built on **Static Hermes (`static_h`)**, **C++20 JSI**, **64-byte-aligned Stationary DMA**, and **[Cordis](https://github.com/shigma/cordis)** ([`vendor/cordis`](vendor/cordis), [arXiv:2608.25512](https://arxiv.org/abs/2608.25512)).

### The Self-Contained Desktop Paradigm (AppImage Model)

Following the Linux AppImage (Type 2) packaging model, LynxFita builds desktop applications into self-contained, hermetic executable distributions:

```
+-----------------------------------------------------------------------------------+
| Self-Contained Desktop Target (Linux AppImage / Portable Win32 PE / macOS .app)   |
|                                                                                   |
|  1. C++20 Native Host Runtime (Static Hermes + JSI Engine)                        |
|  2. Release Integrity & Signature Section (.upd_info + Ed25519 signature)         |
|  3. Hermetic Embedded Payload:                                                    |
|     ├── bundles/ (Compiled .hbc Hermes bytecode for application & UI)             |
|     ├── plugins/ (Dynamic native libraries .dll/.so/.dylib & Cordis plugins)      |
|     └── assets/  (Static media, icons, and fonts)                                 |
+-----------------------------------------------------------------------------------+
```

- **Zero Manual DLL Wrangling**: Developers and end-users never manually copy DLLs or configure system PATH variables. The packager bundles native host binaries, precompiled bytecode, and plugins into a relocatable tree with deterministic relative library loading (`SetDllDirectoryW` on Windows, `RUNPATH`/`$ORIGIN` on Linux, `@executable_path` on macOS).
- **Replacing Lynxtron**: Lynxtron embeds a complete Node.js instance (~120 MB initial heap) and communicates across an asynchronous IPC JSON bridge. LynxFita embeds Static Hermes C++20 (~6 MB initial heap), replaces JSON IPC with synchronous in-process JSI, and binds directly to 64-byte Stationary DMA memory.

### Cordis Capability Seams

Every runtime capability—across both the TypeScript control plane (`LynxFitaContext`) and the C++20 native engine (`lynxfita::cordis::NativeContext`)—is mounted as a Cordis **Service** with explicit `inject` coeffects and revertible `ctx.effect()` disposers:

| Capability Seam | TypeScript Service | C++20 Native Service | Contract |
| :--- | :--- | :--- | :--- |
| **`ctx.dma`** | `DmaService` (`@lynxfita/core`) | `StationaryDmaArena` (`stationary_dma.cc`) | 64-byte-aligned Stationary DMA arena (`0x0000` weather telemetry, `0x1000` Protobuf wire, `0x2000` SIMD FFI output, `0x3000` WASI linear memory) + PPE/SPE ring lanes. |
| **`ctx.protobuf`** | `ProtobufService` (`@lynxfita/core`) | `ProtobufWireCodec` (`protobuf_frame.cc`) | Zero-JSON binary wire framing (`tag << 3 \| wire_type`) directly over Stationary DMA slots. |
| **`ctx.compiler`** | `CompilerService` (`@lynxfita/core`) | `HermesBytecodeCompiler` (`hermes_compiler.cc`) | Ahead-of-time and runtime JIT/AOT `.hbc` bytecode compilation + stack/register VM execution over DMA and host functions. |
| **`ctx.ffi`** | `FfiService` (`@lynxfita/core`) | `NativeFfiLoader` (`native_ffi_loader.cc`) | Cross-platform dynamic shared library loader (`LoadLibraryExW` on Win32, `dlopen` on Linux/macOS) with automatic `FreeLibrary`/`dlclose` on `Fiber._unload()`. |
| **`ctx.wasi`** | `WasiComponentService` (`@lynxfita/wasi-runtime`) | `WasiHostModule` (`wasi_host_module.cc`) | WIT (WebAssembly Interface Types) universal module IR (`@lynxfita/codegen`) + LEB128 Wasm binary parser and stack machine bound to Stationary DMA. |
| **`ctx.gpu`** | `GpuService` (`@lynxfita/core`) | — | W3C WebGPU two-buffer staging (`MAP_READ` / `COPY_DST`), WGSL compute shaders, and `huggingface/kernels` catalog dispatch. |
| **`ctx.federation`** | `FederationService` (`@lynxfita/updater`) | — | Reconciles embedded installation bundles (`1.0.0-embedded`) against remote federated bundles using Ed25519 cryptographic signatures and SHA-256 payload integrity verification, with deterministic rollback on mismatch. |

> Interactive architecture overview: [`docs/cordis-primer.md`](docs/cordis-primer.md) &bull; [`docs/architecture/001-lynx-vs-lynxtron-desktop-dichotomy.md`](docs/architecture/001-lynx-vs-lynxtron-desktop-dichotomy.md)

---

## 2. Desktop Shell & Application Showcases

Applications and plugins run in isolated Cordis Fibers (`ctx.isolate()`), acquiring DMA and FFI resources through revertible `ctx.effect()` registrations and releasing them in LIFO order on teardown:

<div align="center">
  <img src="docs/assets/lynxfita-explorer-demo.gif" alt="LynxFita Desktop Explorer Session" width="100%" />
</div>

| Project / Showcase | Path | Capabilities Demonstrated |
| :--- | :--- | :--- |
| **Desktop Shell Host** | [`examples/explorer`](examples/explorer) | Desktop application shell, route navigation (`lynxfita://home`, `lynxfita://settings`, `lynxfita://miniapp/*`), isolated Cordis Fiber container manager, Stationary DMA memory inspector, and HTTP dev preview server (`pnpm explore` at `http://127.0.0.1:4173`). |
| **Weather Showcase MVI** | [`examples/weather-showcase`](examples/weather-showcase) | Real desktop weather application built on MVI unidirectional architecture (`forecast-home`, `hourly-detail`, `city-search`, `location-error-boundary`), dark/light themes (`#f9d65d`), all 14 OpenWeatherMap conditions, with background SIMD and DMA telemetry synchronization. |
| **WIT & Native SIMD Studio** | [`examples/explorer/src/miniapps/wit_ffi_studio_miniapp.ts`](examples/explorer/src/miniapps/wit_ffi_studio_miniapp.ts) | Interactive WIT interface parser (`parseWitSpec`), universal IR code generator, and zero-copy SIMD execution over DMA offset `0x2000`. |
| **Stationary DMA & GPU Lab** | [`examples/explorer/src/miniapps/dma_gpu_lab_miniapp.ts`](examples/explorer/src/miniapps/dma_gpu_lab_miniapp.ts) | 16 KB Stationary DMA slot layout visualizer (`0x0000`–`0x3FFF`), raw memory inspector, and 60 FPS atmospheric wave canvas. |
| **`lynxfita_explorer` Native Host** | [`src/native/src/explorer_main.cc`](src/native/src/explorer_main.cc) | Self-contained C++20 native executable supporting Win32 desktop GUI window (`--gui`), `.hbc` bytecode execution (`--run`), and automated navigation verification (`--verify-navigation`). |

<p align="center">
  <img src="docs/assets/weather-showcase-dark.png" alt="Weather Showcase Dark Mode" width="49%" />
  <img src="docs/assets/weather-showcase-light.png" alt="Weather Showcase Light Mode" width="49%" />
</p>

---

## 3. Ed25519 Release Integrity & OTA Module Federation

LynxFita separates application runtime execution from identity management. Cryptography exists exclusively for **release integrity**, **binary provenance**, and **verified over-the-air (OTA) updates**:

1. **Signed Release Manifests (`@lynxfita/builder`)**: The build pipeline packages compiled Hermes bytecode (`.hbc`), native plugins, and assets, computing SHA-256 digests for each artifact in `release.manifest.json`. The manifest is cryptographically signed using the release authority's Ed25519 private key (`release.sig`).
2. **Cryptographic Integrity Verification (`@lynxfita/updater`)**: When checking for OTA updates via GitHub Releases or package registries, `@lynxfita/updater` verifies the Ed25519 digital signature against the embedded public key and checks that every payload SHA-256 matches before staging.
3. **Deterministic Rollback & Fallback (`ctx.federation`)**: If a remote bundle fails signature verification, contains a mismatched checksum, or encounters a runtime fault, the reconciler unloads the child Fiber and falls back deterministically to the embedded installation baseline bundle (`1.0.0-embedded`), maintaining host stability.

---

## 4. Statistical Performance Benchmarks (Kalibera & Jones Methodology)

Measured via `pnpm bench` ([`benchmarks/run_benchmarks.ts`](benchmarks/run_benchmarks.ts)) using 10 discarded warm-up rounds followed by $N = 30$ independent sample batches per regime on `AMD Ryzen 5 4500 6-Core Processor` (`Windows_NT 10.0.19045 x64`, `Node.js v26.12.1`). Full report: [`BENCHMARK.md`](BENCHMARK.md).

| Subsystem / Benchmark | Payload | $p50$ ($\mu\text{s}$) | IQR ($\mu\text{s}$) | $p95$ ($\mu\text{s}$) | $p99$ ($\mu\text{s}$) | Mean $\pm$ 95% CI ($\mu\text{s}$) | Throughput (MB/s) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Stationary DMA Transfer** | `64 B` | `0.60` | `0.00` | `1.20` | `2.20` | `0.70 ± 0.10` | `88.46` |
| **Stationary DMA Transfer** | `4 KB` | `0.60` | `0.00` | `1.00` | `1.10` | `0.60 ± 0.00` | `6,135.47` |
| **Stationary DMA Transfer** | `64 KB` | `1.60` | `0.00` | `1.80` | `2.00` | `1.60 ± 0.00` | `38,981.29` |
| **Stationary DMA Transfer** | `1 MB` | `23.10` | `0.20` | `27.40` | `30.70` | `23.50 ± 0.60` | `42,498.94` |
| **SIMD 4-Float Pack/Unpack** | `16 B` | `0.36` | `0.07` | `0.79` | `0.82` | `0.40 ± 0.10` | `38.22` |
| **Protobuf MethodCall Wire** | `64 B` | `7.70` | `2.90` | `16.60` | `17.20` | `9.00 ± 0.90` | `6.80` |
| **Protobuf MethodCall Wire** | `4 KB` | `9.60` | `5.00` | `23.70` | `35.30` | `12.20 ± 2.10` | `319.57` |
| **WASI Linear Memory Interop** | `64 B` | `0.50` | `0.10` | `1.10` | `1.30` | `0.50 ± 0.10` | `117.38` |
| **WASI Linear Memory Interop** | `64 KB` | `21.40` | `3.60` | `31.60` | `32.60` | `21.90 ± 1.40` | `2,851.28` |
| **WASI Linear Memory Interop** | `1 MB` | `285.20` | `85.90` | `472.80` | `631.50` | `306.00 ± 33.60` | `3,268.29` |
| **WebGPU Atmospheric Compute** | `64 B` | `2.90` | `0.20` | `3.60` | `12.20` | `3.20 ± 0.60` | `18.92` |
| **Hermes HBC Bytecode Compiler** | `53 B` | `1.20` | `0.20` | `2.50` | `4.80` | `1.40 ± 0.30` | `36.19` |

---

## 5. Quick Start & Developer Workflow

### Prerequisites
- Windows 10/11 (x64), Linux (Ubuntu 22.04+), or macOS (arm64)
- Node.js (v22.6+ with `--experimental-strip-types`) & pnpm (v10+)
- CMake (3.20+) & C++20 compiler (MSVC 2022/2026, Clang 16+, or GCC 13+)

### Build & Verification Commands

```bash
# 1. Install dependencies & materialize workspace proxies
pnpm install

# 2. Compile all TypeScript workspaces
pnpm build

# 3. Run the full verification pyramid (anti-slop docs gate + unit + integration + E2E browser tests)
pnpm test

# 4. Build and run the native C++20 engine, dynamic .dll/.so plugin, and 14 native test suites
pnpm test:native

# 5. Launch the interactive desktop shell explorer at http://127.0.0.1:4173
pnpm explore

# 6. Execute Kalibera & Jones N = 30 statistical benchmarks and update BENCHMARK.md
pnpm bench
```

### `@lynxfita/cli` Commands

The LynxFita CLI manages the development lifecycle of desktop applications and Cordis plugins:

```bash
# Scaffold a new self-contained desktop project
lynxfita init project my-weather-app

# Scaffold a new reusable Cordis plugin
lynxfita init plugin my-simd-filter

# Start local development mode with live reload
lynxfita dev

# Compile Hermes bytecode (.hbc) and build native host targets
lynxfita build

# Package self-contained executable distribution (AppImage / Portable PE / .app)
lynxfita pack

# Inspect system toolchains, GPU drivers, and Stationary DMA availability
lynxfita doctor
```

---

## 6. Monorepo Organization & Recursive Governance

Each directory is governed by a local `AGENTS.md` progressive-disclosure indexer:

```
lynxfita/
├── AGENTS.md                # Root standing orders & Cordis capability seam contract
├── BENCHMARK.md             # Reproducible Kalibera & Jones statistical benchmark report
├── .agents/                 # Specialist agent profiles & skills (archify, dsh-prose-standard, record-browser-gif)
├── benchmarks/              # N = 30 statistical benchmark harness & JSON provenance (benchmarks/AGENTS.md)
├── docs/                    # Architecture documentation, Cordis primer, transcripts & glossary (docs/AGENTS.md)
├── examples/                # Desktop Shell Explorer, Weather Showcase MVI & plugins (examples/AGENTS.md)
│   ├── explorer/            # Desktop shell host, application containers & HTTP dev server
│   ├── weather-showcase/    # Clean MVI weather radar with SIMD acceleration & DMA 0x2000 sync
│   └── plugins/             # Standalone Cordis plugin projects (weather-simd)
├── packages/                # Pure TypeScript Cordis workspaces (packages/AGENTS.md)
│   ├── core/                # LynxFitaContext, Fiber, Service, Stationary DMA, Protobuf, HBC VM & WebGPU
│   ├── codegen/             # WIT universal module IR parser & typed Cordis/JSI/WASI generator
│   ├── wasi-runtime/        # WASI component service bound to Stationary DMA
│   ├── builder/             # Self-contained bundle packager, Hermes compiler & signed manifest generator
│   ├── updater/             # Ed25519 release integrity, SHA-256 payload verification & OTA reconciler
│   └── cli/                 # Developer CLI (init, codegen, build, pack, doctor)
├── scripts/                 # Pure TypeScript workspace setup, native build/test, vendor sync & docs verifier
├── src/native/              # C++20 NativeContext, LoadLibraryExW/dlopen FFI, HBC VM, Wasm VM & lynxfita_explorer
├── tests/                   # Cross-package integration & full-lifecycle E2E test suites
└── vendor/                  # 10 zero-fork pinned upstream submodules (cordis, hermes, lynx, kernels...)
```

---

## 7. Backing the Research & Patronage

<div align="center">

### 🖤🐧 *"Enjoyed the session? Satisfied with how I perform?"*

*Help keep a working girl's late-night research alive by tipping any amount. Who knows — I might spin up a private dashboard and unlock exclusive behind-the-scenes builds for my top patrons. No promises, just immeasurable value to keep the sessions going!*

<br />

[![Tip via Stripe](https://img.shields.io/badge/Tip_via_Stripe-🖤🐧_FitaLabs-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://donate.stripe.com/9B66oHaordEdf36erNfEk00)&nbsp;&nbsp;&nbsp;[![GitHub Sponsors](https://img.shields.io/badge/GitHub_Sponsors-♥_aleffita-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/aleffita)

</div>

---

## 8. License

Licensed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for details.
