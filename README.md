<div align="center">

# LynxFita

**Modular Desktop Application Runtime Architecture for LynxJS**

*Cordis Microkernel Spine &bull; C++20 JSI Host Objects & Dynamic FFI &bull; Shared Memory Data Planes &bull; Ed25519 Release Provenance*

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI Status](https://github.com/aleffita/lynxfita/actions/workflows/ci.yml/badge.svg)](https://github.com/aleffita/lynxfita/actions)
[![C++20](https://img.shields.io/badge/C%2B%2B-20-00599C?logo=c%2B%2B)](https://en.cppreference.com/w/cpp/20)
[![pnpm workspace](https://img.shields.io/badge/pnpm-workspace-orange?logo=pnpm)](https://pnpm.io/)
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

## 1. Overview & Architecture

**LynxFita** is an open-source experimental desktop application runtime for LynxJS, exploring an endogenous microkernel architecture powered by **[Cordis](https://github.com/shigma/cordis)** ([`vendor/cordis`](vendor/cordis), [arXiv:2608.25512](https://arxiv.org/abs/2608.25512)).

### The Architectural Problem Space

In modern desktop application development, developers face structural trade-offs between web runtimes and native embedding:
- **Lynxtron (`vendor/lynxtron`)**: Pairs Node.js with Lynx (`LynxWindow`), utilizing Node-API and Chromium-derived platform window plumbing.
- **LynxFita Approach**: Explores an endogenous Cordis capability seam model. Every subsystem—memory buffers, binary wire serialization, bytecode execution, dynamic native libraries, and release integrity—is mounted as a revertible Cordis service on a unified context (`LynxFitaContext` in TypeScript and `lynxfita::cordis::NativeContext` in C++20).

```
+-----------------------------------------------------------------------------------+
| LynxFita Application Distribution Layout                                          |
|                                                                                   |
|  1. C++20 Native Engine Host (JSI Engine + Dynamic FFI Loader)                    |
|  2. Release Manifest & Digital Provenance (.upd_info + Ed25519 signature)         |
|  3. Embedded Application Payload:                                                 |
|     ├── bundles/ (Application control plane & UI component bundles)               |
|     ├── plugins/ (Dynamic shared libraries .dll/.so/.dylib & Cordis plugins)      |
|     └── assets/  (Static assets, fonts, and application metadata)                 |
+-----------------------------------------------------------------------------------+
```

### Cordis Capability Seams

Subsystems are implemented as Cordis **Services** with declared dependencies (`inject`) and lifecycle disposers (`ctx.effect()`):

| Capability Seam | TypeScript Service | C++20 Native Service | Material Implementation Status |
| :--- | :--- | :--- | :--- |
| **`ctx.dma`** | `DmaService` (`@lynxfita/core`) | `DmaEibEngine` (`dma_eib_engine.cc`) | 64-byte aligned stationary memory arena (`0x0000` telemetry, `0x1000` wire buffer, `0x2000` SIMD slot) with parallel worker lanes. |
| **`ctx.protobuf`** | `ProtobufService` (`@lynxfita/core`) | `ProtobufBridge` (`protobuf_bridge.cc`) | Varint and binary wire framing (`tag << 3 \| wire_type`) over shared memory slots. |
| **`ctx.ffi`** | `FfiService` (`@lynxfita/core`) | `NativeFfiLoader` (`native_ffi_loader.cc`) | Dynamic shared library loader (`LoadLibraryExW` on Win32, `dlopen` on POSIX) with automatic cleanup on Fiber unload. |
| **`ctx.compiler`** | `CompilerService` (`@lynxfita/core`) | `HermesCompiler` (`hermes_compiler.cc`) | Control-plane compiler interface. *[Roadmap: Direct CMake integration with `vendor/hermes` tools/hermesc]*. |
| **`ctx.wasi`** | `WasiComponentService` (`@lynxfita/wasi-runtime`) | `WasiHostModule` (`wasi_host_module.cc`) | Linear memory interop and WIT interface parser (`@lynxfita/codegen`). *[Roadmap: Bytecode Alliance Wasmtime integration]*. |
| **`ctx.gpu`** | `GpuService` (`@lynxfita/core`) | — | WebGPU pipeline abstraction. *[Roadmap: Native Dawn/wgpu C++ backend dispatch]*. |
| **`ctx.federation`** | `FederationService` (`@lynxfita/updater`) | — | Validates release manifests and updates using Ed25519 digital signatures and SHA-256 digests. |

---

## 2. Desktop Shell & Application Showcases

Applications and plugins run in isolated Cordis Fibers (`ctx.isolate()`), acquiring resources via revertible effects:

<div align="center">
  <img src="docs/assets/lynxfita-explorer-demo.gif" alt="LynxFita Desktop Explorer Session" width="100%" />
</div>

| Project / Showcase | Path | Description & Runtime Environment |
| :--- | :--- | :--- |
| **Desktop Shell Preview** | [`examples/explorer`](examples/explorer) | TypeScript interactive developer shell demonstrating Cordis service lifecycle, route navigation (`lynxfita://home`, `lynxfita://settings`), and memory slot inspection. Serves local preview at `http://127.0.0.1:4173` via `pnpm explore`. |
| **Weather Showcase MVI** | [`examples/weather-showcase`](examples/weather-showcase) | Unidirectional Model-View-Intent weather radar application (`forecast-home`, `hourly-detail`, `city-search`), dark/light themes (`#f9d65d`), 14 weather conditions, and SIMD telemetry integration. |
| **WIT & Native SIMD Studio** | [`examples/explorer/src/miniapps/wit_ffi_studio_miniapp.ts`](examples/explorer/src/miniapps/wit_ffi_studio_miniapp.ts) | Interactive WebAssembly Interface Type (WIT) parser (`parseWitSpec`) and SIMD execution interface over memory slot `0x2000`. |
| **Stationary DMA Lab** | [`examples/explorer/src/miniapps/dma_gpu_lab_miniapp.ts`](examples/explorer/src/miniapps/dma_gpu_lab_miniapp.ts) | Memory slot visualizer (`0x0000`–`0x3FFF`) and canvas visualization. |
| **`lynxfita_explorer` Native Host** | [`src/native/src/explorer_main.cc`](src/native/src/explorer_main.cc) | Win32 native test runner and demonstration binary for C++20 engine validation. *[Roadmap: LynxView hardware rendering surface integration via `vendor/lynxtron`]*. |

<p align="center">
  <img src="docs/assets/weather-showcase-dark.png" alt="Weather Showcase Dark Mode" width="49%" />
  <img src="docs/assets/weather-showcase-light.png" alt="Weather Showcase Light Mode" width="49%" />
</p>

---

## 3. Release Provenance & Cryptographic Integrity

LynxFita incorporates digital signatures for **binary release integrity** and **over-the-air update verification**:

1. **Signed Release Manifests (`@lynxfita/builder`)**: The packaging pipeline generates `release.manifest.json` containing SHA-256 digests for all bundle payloads and dynamic libraries, signed with an Ed25519 private key (`release.sig`).
2. **Cryptographic Verification (`@lynxfita/updater`)**: The updater service verifies the digital signature against the embedded public key and validates payload SHA-256 hashes prior to staging updates.
3. **Deterministic Rollback (`ctx.federation`)**: If a remote bundle fails verification or encounters an unhandled fault, the reconciler unloads the affected Fiber and restores the embedded baseline bundle.

---

## 4. Performance & Microbenchmarks

Statistical microbenchmarks are executed via `pnpm bench` ([`benchmarks/run_benchmarks.ts`](benchmarks/run_benchmarks.ts)) using the Kalibera & Jones standard ($N = 30$ independent sample batches after 10 discarded warm-up rounds).

Full methodology and report: [`BENCHMARK.md`](BENCHMARK.md).

> **Measurement Context Note**: The table below reflects memory operations executed on Node.js v26.12.1 (`AMD Ryzen 5 4500 6-Core Processor`, `Windows NT 10.0.19045 x64`). High throughput metrics represent in-memory V8 TypedArray buffer operations, not hardware peripheral DMA transfers.

| Subsystem / Operation | Payload | $p50$ ($\mu\text{s}$) | IQR ($\mu\text{s}$) | $p95$ ($\mu\text{s}$) | $p99$ ($\mu\text{s}$) | Mean $\pm$ 95% CI ($\mu\text{s}$) | Throughput (MB/s) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **In-Memory Buffer Transfer** | `64 B` | `0.60` | `0.00` | `1.20` | `2.20` | `0.70 ± 0.10` | `88.46` |
| **In-Memory Buffer Transfer** | `4 KB` | `0.60` | `0.00` | `1.00` | `1.10` | `0.60 ± 0.00` | `6,135.47` |
| **In-Memory Buffer Transfer** | `64 KB` | `1.60` | `0.00` | `1.80` | `2.00` | `1.60 ± 0.00` | `38,981.29` |
| **In-Memory Buffer Transfer** | `1 MB` | `23.10` | `0.20` | `27.40` | `30.70` | `23.50 ± 0.60` | `42,498.94` |
| **SIMD Float View Pack/Unpack** | `16 B` | `0.36` | `0.07` | `0.79` | `0.82` | `0.40 ± 0.10` | `38.22` |
| **Protobuf Method Wire Encoding**| `64 B` | `7.70` | `2.90` | `16.60` | `17.20` | `9.00 ± 0.90` | `6.80` |
| **Protobuf Method Wire Encoding**| `4 KB` | `9.60` | `5.00` | `23.70` | `35.30` | `12.20 ± 2.10` | `319.57` |
| **Linear Memory Read/Write** | `64 B` | `0.50` | `0.10` | `1.10` | `1.30` | `0.50 ± 0.10` | `117.38` |
| **Linear Memory Read/Write** | `64 KB` | `21.40` | `3.60` | `31.60` | `32.60` | `21.90 ± 1.40` | `2,851.28` |
| **Linear Memory Read/Write** | `1 MB` | `285.20` | `85.90` | `472.80` | `631.50` | `306.00 ± 33.60` | `3,268.29` |

---

## 5. Quick Start & Developer Workflow

### Prerequisites
- Windows 10/11 (x64), Linux (Ubuntu 22.04+), or macOS (arm64)
- Node.js (v22.6+ with `--experimental-strip-types`) & pnpm (v10+)
- CMake (3.20+) & C++20 compiler (MSVC 2022/2026, Clang 16+, or GCC 13+)

### Build & Verification Commands

```bash
# 1. Install dependencies & materialize workspace links
pnpm install

# 2. Compile all TypeScript workspaces
pnpm build

# 3. Run verification test suites
pnpm test

# 4. Build and execute native C++20 engine test runner
pnpm test:native

# 5. Launch the developer preview shell at http://127.0.0.1:4173
pnpm explore

# 6. Run statistical benchmarks
pnpm bench
```

---

## 6. Monorepo Organization & Subtree Governance

Each subtree is governed by an authoritative local `AGENTS.md` indexer:

```
lynxfita/
├── AGENTS.md                # Root standing orders & Cordis capability seam contract
├── BENCHMARK.md             # Kalibera & Jones statistical benchmark report
├── .agents/                 # Specialist agent skills (archify, dsh-prose-standard, record-browser-gif)
├── benchmarks/              # N = 30 statistical benchmark harness & JSON provenance (benchmarks/AGENTS.md)
├── docs/                    # Architecture documentation, Cordis primer, transcripts & glossary (docs/AGENTS.md)
├── examples/                # Application showcases & developer preview (examples/AGENTS.md)
│   ├── explorer/            # Developer preview shell host & miniapps
│   ├── weather-showcase/    # MVI weather application with telemetry sync
│   └── plugins/             # Dynamic shared library plugins (weather-simd)
├── packages/                # TypeScript Cordis workspaces (packages/AGENTS.md)
│   ├── core/                # LynxFitaContext, Fiber, Service, Shared Memory & Wire Codec
│   ├── codegen/             # WIT universal module IR parser & generator
│   ├── wasi-runtime/        # WASI memory management service
│   ├── builder/             # Distribution packager & Ed25519 manifest signer
│   ├── updater/             # Release integrity & signature verification service
│   └── cli/                 # Development lifecycle CLI
├── scripts/                 # Workspace setup, native build/test & docs verifier
├── src/native/              # C++20 NativeContext, LoadLibraryExW/dlopen FFI & test runner
├── tests/                   # Cross-package integration and lifecycle test suites
└── vendor/                  # Pinned upstream submodules (cordis, hermes, lynx, lynxtron...)
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
