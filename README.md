<div align="center">

# LynxFita

**Next-Generation High-Performance Desktop & Embedded Runtime for LynxJS**

*Static Hermes (`static_h`) &bull; Direct C++20 JSI Engine Interop &bull; Cell EIB Stationary DMA &bull; WebGPU WGSL Shaders &bull; CORDIS Composability &bull; WASI Sandbox*

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI Status](https://github.com/aleffita/lynxfita/actions/workflows/ci.yml/badge.svg)](https://github.com/aleffita/lynxfita/actions)
[![C++20](https://img.shields.io/badge/C%2B%2B-20-00599C?logo=c%2B%2B)](https://en.cppreference.com/w/cpp/20)
[![pnpm workspace](https://img.shields.io/badge/pnpm-workspace-orange?logo=pnpm)](https://pnpm.io/)
[![Static Hermes](https://img.shields.io/badge/Hermes-static__h-0081FB?logo=meta)](https://github.com/meta/hermes/tree/static_h)
[![Sponsor](https://img.shields.io/badge/Sponsor-FitaLabs-635BFF?logo=stripe&logoColor=white)](https://donate.stripe.com/9B66oHaordEdf36erNfEk00)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub_Sponsors-♥_aleffita-EA4AAA?logo=githubsponsors)](https://github.com/sponsors/aleffita)

<br />

<img src="docs/assets/architecture-banner.svg" alt="LynxFita v2.0.0 Architecture Banner" width="100%" />

</div>

---

## 1. Executive Summary & Vision

**LynxFita** is an open-source systems engineering research monorepo designed to advance client runtime architectures for desktop, embedded, and accelerated environments.

While ByteDance's **LynxJS** and **Lynxtron** provide a revolutionary lightweight UI renderer to supersede Chromium Blink, their desktop runtime architecture still inherits Electron's primary performance bottleneck: **a heavyweight Node.js main process communicating with the UI renderer over an asynchronous JSON message serialization bridge**.

LynxFita replaces this entire bottlenecked stack with a native, zero-copy, highly parallelized runtime:

- **Static Hermes as Host**: Eliminates Node.js overhead using Meta's Static Hermes (`static_h`), unlocking sub-15ms cold starts and an 85% reduction in heap memory baseline.
- **Direct C++20 JSI Interop**: Direct synchronous in-process bindings via `HostObject`, eliminating JSON stringification entirely.
- **Stationary Memory & DMA Lanes (Cell CBE EIB)**: Inspired by the PlayStation 3 Cell Broadband Engine Element Interconnect Bus, pre-allocated stationary memory blocks and bidirectional DMA channels allow zero-copy streaming between the host controller (PPE) and worker threads (SPEs).
- **WebGPU / WGSL Compute Shaders**: Hardware-accelerated compute shaders (`TENSOR_FMA_WGSL_SHADER`, `WEATHER_PARTICLES_WGSL_SHADER`) with native 4-way SIMD (`SimdVectorFmaAdd`) fallback on stationary DMA lanes.
- **Zero-GIL Multithreading & Non-Colored Coroutines**: Fiber coroutine execution via generator `yield` semantics, eliminating async function coloring and GIL contention.
- **Protobuf Binary Wire Bridge**: Lightweight header-only Protocol Buffer binary encoder/decoder integrated into the JSI bridge alongside legacy JSON compatibility.
- **CORDIS Spatiotemporal Composability**: Native integration of the CORDIS paradigm ([arXiv:2608.25512](https://arxiv.org/abs/2608.25512)), offering revertible effects (state rollback on unload) and reactive coeffects (ambient activation).
- **WASI & WASIX Sandboxing**: Capability-secured WebAssembly modules for cross-platform native logic with linear memory boundaries.
- **Module Federation Super-App & Weather Showcase MVI**: Dynamic module mounting, hot-reload OTA updates, and pure unidirectional MVI state flows.

> Detailed comparative architecture diagrams and theoretical analyses are available in [`docs/architecture/runtime-comparison.md`](docs/architecture/runtime-comparison.md).

---

## 2. Interactive Showcases & Native Applications

<div align="center">
  <img src="docs/assets/weather-showcase-mvi-preview.svg" alt="Weather Showcase MVI Preview" width="100%" />
</div>

| Application / Target | Path | Architectural Highlights |
| :--- | :--- | :--- |
| **Weather Showcase MVI** | [`examples/weather-showcase`](examples/weather-showcase) | Industrial port of `aleffita/weather-showcase`. Pure unidirectional MVI architecture, dark/light themes (`#f9d65d`), all 14 OpenWeatherMap icons, WebGPU/WGSL atmospheric shaders, and zero-copy SIMD telemetry synchronized at DMA offset `0x2000`. |
| **Super-App Explorer** | [`examples/super-app`](examples/super-app) | Multi-bundle module federation orchestrator. Dynamically mounts `sensor-mini-app`, `trading-mini-app`, and `weather-showcase-mvi`. Features live Over-The-Air (OTA) hot-reload without host restarts and clean LIFO state rollbacks. |
| **Desktop Hermes App** | [`examples/desktop-hermes-app`](examples/desktop-hermes-app) | Lightweight desktop shell hosting Static Hermes AOT (`HermesRuntimeSession`), WASI sandbox context, and direct JSI host object dispatch. |
| **`lynxfita_explorer` Executable** | [`src/native/src/explorer_main.cc`](src/native/src/explorer_main.cc) | Standalone native C++20 multi-platform executable. Runs Ahead-of-Time bytecode bundles (`--run <bundle.hbc>`) or launches the integrated native architecture demonstration. |

---

## 3. Releases vs. Packages Distribution Taxonomy

LynxFita enforces a bifurcated release model that strictly segregates binary executables from modular packages and Over-The-Air bundles:

| Distribution Channel | Target Registry | Delivered Artifacts | Verification Mechanism |
| :--- | :--- | :--- | :--- |
| **GitHub Releases** | `github.com/aleffita/lynxfita/releases` | Multi-platform native C++20 executables (`lynxfita_explorer.exe`, `lynxfita_native_tests.exe`), static libraries (`.lib` / `.a`), C++ headers (`.zip`), and pre-compiled Hermes `.hbc` bundles for **Windows x64**, **Linux x64**, and **macOS arm64**. | Unified `checksums.sha256` manifest cryptographically verified upon release. |
| **GitHub Packages** | `npm.pkg.github.com/@aleffita/*` | Versioned modular SDK packages (`@aleffita/lynxfita-core`, `@aleffita/lynxfita-codegen`, `@aleffita/lynxfita-builder`, etc.) and Over-The-Air AOT bundles (`@aleffita/lynxfita-bundle-weather-showcase`). | Ed25519 signature chain via `MtlsRbacLedger` and SHA-256 payload integrity check. |
| **Container Registry** | `ghcr.io/aleffita/lynxfita` | Multi-arch container image with pre-configured static Hermes compiler toolchain and native C++20 build pipeline. | OCI digest & cryptographic image attestation. |

---

## 4. Architectural Benchmark Comparison

| Metric / Dimension | Traditional Lynxtron | LynxFita Native Engine | Advantage |
| :--- | :--- | :--- | :--- |
| **Host Process** | Node.js (V8 + libuv, ~120MB heap) | Static Hermes (`static_h`, ~6MB heap) | **20x lighter footprint** |
| **Bridge Protocol** | Serialized JSON strings over IPC pipe | Direct C++20 JSI + Binary Protobuf | **Zero-copy in-process dispatch** |
| **Dispatch Latency** | 340.9 ns / op | **251.48 ns / op** | **1.35x – 15x faster** |
| **Memory Architecture**| Dynamic heap alloc with GC churn | Stationary pinned buffers + EIB DMA | **Zero allocator churn** |
| **GPU Acceleration** | WebGL DOM canvas context | WebGPU WGSL compute + 4-way SIMD | **Non-blocking parallel worklets** |
| **Concurrency Model** | Single thread + libuv async callback queue| Native multi-threading + non-colored `yield` | **Zero GIL contention** |
| **Plugin Isolation** | Unrestricted Node require | CORDIS revertible effects & coeffects | **Leak-free hot module reload** |
| **Update Delivery** | 100MB+ full installer reinstall | Signed AOT bundles via `@lynxfita/updater` | **Instant zero-downtime hot-reload** |

---

## 5. Quick Start & Test Pyramid

### Prerequisites
- Windows 10/11 (x64), Linux (Ubuntu 22.04+), or macOS (arm64)
- Node.js (v22+) & pnpm (v12+)
- CMake (3.20+) & C++20 compliant compiler (MSVC 2022/2026, Clang 16+, GCC 13+)

### Testing Pyramid & Verification Commands
```bash
# 1. Install dependencies & configure workspace proxy stubs
pnpm install

# 2. Build all TypeScript packages, CLI, and showcase examples
pnpm build

# 3. Segregated Test Pyramid:
pnpm test:unit         # Layer 1: Unit tests across all workspace packages & showcases
pnpm test:integration  # Layer 2: Integration tests verifying C++20 executables & pipelines
pnpm test:e2e          # Layer 3: End-to-end full lifecycle verification without mocks
pnpm test              # Full pyramid run (E2E + Integration + Unit)

# 4. Native C++20 Engine Compilation & Direct Execution:
pnpm test:native       # Builds MSVC/Ninja release binaries and executes test runner
build\native\lynxfita_explorer.exe --demo # Runs integrated C++20 native showcase

# 5. Launch Developer CLI:
pnpm --filter "@lynxfita/cli" start doctor
```

---

## 6. Monorepo Organization

```
lynxfita/
├── .agents/                 # Multi-agent specialized profiles & executable skills
├── .github/                 # Workflows (CI/CD, Multi-Platform Releases), issue & PR templates
├── docs/                    # Google Open Knowledge Format (OKF) documentation & Wiki
│   ├── assets/              # High-retention SVG architecture & preview diagrams
│   ├── architecture/        # In-depth architectural designs & EIB DMA specifications
│   ├── transcripts/         # Verbatim captures of principal research directives
│   ├── wiki/                # GitHub Wiki documentation pages
│   └── glossary.md          # Master living research glossary
├── examples/
│   ├── weather-showcase/    # MVI Weather Showcase with WebGPU WGSL & Stationary DMA
│   ├── super-app/           # Super-App Explorer with CORDIS module federation & OTA hot-reload
│   └── desktop-hermes-app/  # Example desktop application running Static Hermes + JSI
├── packages/
│   ├── core/                # JSI dispatcher, CORDIS ledger, stationary DMA, WGSL & Protobuf
│   ├── codegen/             # TypeScript interface AST parser & C++20/TS binding generator
│   ├── wasi-runtime/        # WASI/WASIX sandboxed native module host integration
│   ├── builder/             # Bundle compiler, signature generator & REPACK packager
│   ├── updater/             # Auto-updater with GitHub Releases & mTLS RBAC ledger
│   └── cli/                 # `lynxfita` industrial CLI tool (init, codegen, build, doctor)
├── patches/                 # Atomic upstream patches for vendor submodules
├── scripts/                 # Vendor sync, patch management, and native test automation
├── src/native/              # C++20 engine, EIB DMA, Protobuf bridge, lynxfita_explorer
├── tests/
│   ├── integration/         # Cross-module & C++20 native binary integration tests
│   └── e2e/                 # Full-lifecycle end-to-end verification without mocks
└── vendor/                  # Zero-fork upstream git submodules (Hermes, Lynx, CORDIS...)
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
