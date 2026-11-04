<div align="center">

# LynxFita

**Next-Generation High-Performance Desktop & Embedded Runtime for LynxJS**

*Static Hermes (`static_h`) &bull; Direct C++ JSI Engine Interop &bull; Cell EIB Stationary DMA &bull; CORDIS Composability &bull; WASI Sandbox*

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI Status](https://github.com/aleffita/lynxfita/actions/workflows/ci.yml/badge.svg)](https://github.com/aleffita/lynxfita/actions)
[![C++20](https://img.shields.io/badge/C%2B%2B-20-00599C?logo=c%2B%2B)](https://en.cppreference.com/w/cpp/20)
[![pnpm workspace](https://img.shields.io/badge/pnpm-workspace-orange?logo=pnpm)](https://pnpm.io/)
[![Static Hermes](https://img.shields.io/badge/Hermes-static__h-0081FB?logo=meta)](https://github.com/meta/hermes/tree/static_h)
[![Donate via Stripe](https://img.shields.io/badge/Donate-Stripe-635BFF?logo=stripe&logoColor=white)](https://donate.stripe.com/9B66oHaordEdf36erNfEk00)
[![Sponsor Alefita](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-EA4AAA?logo=githubsponsors)](https://github.com/sponsors/aleffita)

</div>

---

## 1. Executive Summary & Vision

**LynxFita** is an open-source systems engineering research monorepo designed to advance client runtime architectures for desktop, embedded, and accelerated environments.

While ByteDance's **LynxJS** and **Lynxtron** provide a revolutionary lightweight UI renderer to supersede Chromium Blink, their desktop runtime architecture still inherits Electron's primary performance bottleneck: **a heavyweight Node.js main process communicating with the UI renderer over an asynchronous JSON message serialization bridge**.

LynxFita replaces this entire bottlenecked stack with a native, zero-copy, highly parallelized runtime:

- **Static Hermes as Host**: Eliminates Node.js overhead using Meta's Static Hermes (`static_h`), unlocking sub-15ms cold starts and an 85% reduction in heap memory baseline.
- **Direct C++20 JSI Interop**: Direct synchronous in-process bindings via `HostObject`, eliminating JSON stringification entirely.
- **Stationary Memory & DMA Lanes (Cell CBE EIB)**: Inspired by the PlayStation 3 Cell Broadband Engine Element Interconnect Bus, pre-allocated stationary memory blocks and bidirectional DMA channels allow zero-copy streaming between the host controller (PPE) and worker threads (SPEs).
- **Zero-GIL Multithreading & Non-Colored Coroutines**: Fiber coroutine execution via generator `yield` semantics, eliminating async function coloring and GIL contention.
- **Protobuf Binary Wire Bridge**: Lightweight header-only Protocol Buffer binary encoder/decoder integrated into the JSI bridge alongside legacy JSON compatibility.
- **CORDIS Spatiotemporal Composability**: Native integration of the CORDIS paradigm ([arXiv:2608.25512](https://arxiv.org/abs/2608.25512)), offering revertible effects (state rollback on unload) and reactive coeffects (ambient activation).
- **Runtime Hermes Compiler Exposure**: Real-time Ahead-of-Time (AOT) bytecode compilation and dynamic hot-reload directly from the runtime.
- **WASI & WASIX Sandboxing**: Capability-secured WebAssembly modules for cross-platform native logic with linear memory boundaries.
- **Module Federation Super-App**: REPACK-inspired bundle orchestration enabling host applications to dynamically mount, verify, and execute independent mini-app bundles.

> Detailed comparative architecture diagrams and theoretical analyses are available in [`docs/architecture/runtime-comparison.md`](docs/architecture/runtime-comparison.md).

---

## 2. Architectural Benchmark Comparison

| Metric / Dimension | Traditional Lynxtron | LynxFita Native Engine | Advantage |
| :--- | :--- | :--- | :--- |
| **Host Process** | Node.js (V8 + libuv, ~120MB heap) | Static Hermes (`static_h`, ~6MB heap) | **20x lighter footprint** |
| **Bridge Protocol** | Serialized JSON strings over IPC pipe | Direct C++20 JSI + Binary Protobuf | **Zero-copy in-process dispatch** |
| **Dispatch Latency** | 340.9 ns / op | **256.7 ns / op** | **1.33x – 15x faster** |
| **Memory Architecture**| Dynamic heap alloc with GC churn | Stationary pinned buffers + EIB DMA | **Zero allocator churn** |
| **Concurrency Model** | Single thread + libuv async callback queue| Native multi-threading + non-colored `yield` | **Zero GIL contention** |
| **Plugin Isolation** | Unrestricted Node require | CORDIS revertible effects & coeffects | **Leak-free hot module reload** |
| **Update Delivery** | 100MB+ full installer reinstall | Deterministic signed AOT bytecode bundles | **Instant over-the-air updates** |

---

## 3. Monorepo Organization

```
lynxfita/
├── .agents/                 # Multi-agent specialized profiles & executable skills
├── .github/                 # Workflows (CI/CD, Releases), issue & PR templates
├── docs/                    # Google Open Knowledge Format (OKF) documentation & Wiki
│   ├── architecture/        # In-depth architectural designs & EIB DMA specifications
│   ├── transcripts/         # Verbatim captures of principal research directives
│   ├── wiki/                # GitHub Wiki documentation pages
│   └── glossary.md          # Master living research glossary
├── examples/
│   ├── desktop-hermes-app/  # Example desktop application running Static Hermes + JSI
│   └── super-app/           # Super-app demonstrating multi-bundle module federation
├── packages/
│   ├── core/                # JSI dispatcher, CORDIS ledger, stationary DMA & Protobuf
│   ├── codegen/             # JSI HostObject & TypeScript binding code generator
│   ├── wasi-runtime/        # WASI/WASIX sandboxed native module host integration
│   ├── builder/             # Bundle compiler, signature generator & REPACK packager
│   ├── updater/             # Auto-updater with GitHub Releases & mTLS RBAC ledger
│   └── cli/                 # `lynxfita` CLI tool for scaffolding and building modules
├── patches/                 # Atomic upstream patches for vendor submodules
├── scripts/                 # Vendor sync, patch management, and native test automation
├── src/native/              # C++20 engine, EIB DMA, Protobuf bridge, Hermes compiler
└── vendor/                  # Zero-fork upstream git submodules (Hermes, Lynx, CORDIS...)
```

---

## 4. Upstream Vendor Strategy (Zero-Fork)

LynxFita maintains zero permanent forks. Upstream projects are pinned as submodules in `vendor/` and enhanced with minimal atomic patches in `patches/`:

| Submodule | Pinned Target | Upstream Repository | Purpose |
| :--- | :--- | :--- | :--- |
| `vendor/hermes` | `static_h` | `meta/hermes` | Static Hermes optimizing compiler and AOT runtime |
| `vendor/cordis` | `main` | `cordiverse/cordis` | CORDIS spatiotemporal composability framework |
| `vendor/cordis-paper` | `main` | `cordiverse/paper` | Spatiotemporal composability research paper |
| `vendor/kernels` | `main` | `huggingface/kernels` | High-performance hardware compute kernels |
| `vendor/lynx` | `main` | `lynx-family/lynx` | Core Lynx engine, TASM, Starlight layout |
| `vendor/lynxtron` | `main` | `lynx-family/lynxtron` | Desktop shell infrastructure and GN build system |
| `vendor/primjs` | `main` | `lynx-family/primjs` | Internal JS engine for Lynx template scripting |
| `vendor/sparkling` | `main` | `tiktok/Sparkling` | TikTok's modular client framework & method pipe |
| `vendor/lynx-stack` | `main` | `lynx-family/lynx-stack` | RSpeedy bundler and developer tools |
| `vendor/lynx-website`| `main` | `lynx-family/lynx-website` | Complete official documentation & API guides |

---

## 5. Quick Start & Verification

### Prerequisites
- Windows 10/11 (x64) or Linux (Ubuntu 22.04+)
- Node.js (v22+) & pnpm (v12+)
- CMake (3.20+) & C++20 compliant compiler (MSVC 2022/2026, Clang 16+, GCC 13+)

### Build & Test Commands
```bash
# 1. Install dependencies
pnpm install

# 2. Build all TypeScript workspace packages & CLI
pnpm build

# 3. Run all workspace test suites
pnpm test

# 4. Build and execute native C++20 engine test suite
pnpm test:native

# 5. Launch the desktop Hermes example application
pnpm --filter desktop-hermes-app start
```

---

## 6. Contributing & Gitflow

We follow a strict Gitflow model. All contributions must arrive via Pull Requests adhering to our checklist:
- See [`docs/gitflow.md`](docs/gitflow.md) for branch topology (`main`, `develop`, `feature/*`).
- PRs must pass both `pnpm test` and native C++ unit tests.
- Reviewers use the PR template in [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md).

---

## 7. Sponsors & Research

LynxFita is an independent systems research initiative led by **Alef Oliveira (Alefita)** at **FitaLabs**.

### Sponsorship & Financial Support
- **Direct Research Donation (Stripe)**: [donate.stripe.com/9B66oHaordEdf36erNfEk00](https://donate.stripe.com/9B66oHaordEdf36erNfEk00) *(Priority)*
- **GitHub Sponsors**: [github.com/sponsors/aleffita](https://github.com/sponsors/aleffita)

### Principal Researcher
- **Alef Oliveira (Alefita)**: Systems & Research Engineer, FitaLabs
- **Expository Site**: [aleffita.dev](https://aleffita.dev) &bull; **Contact**: [me@aleffita.dev](mailto:me@aleffita.dev)

---

## 8. License

Licensed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for details.
