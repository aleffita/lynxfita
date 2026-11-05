---
type: protocol
title: Master Agentry Protocol & Progressive Disclosure Indexer
description: Authoritative master indexer and governance protocol for autonomous and human agents in the LynxFita monorepo.
tags:
  - agentry
  - protocol
  - progressive-disclosure
  - cordis
  - governance
  - okf
timestamp: 2026-11-05
status: active
author: aleffita
---

# LynxFita Master Agentry Protocol

LynxFita is an all-plugin, Cordis-powered ([`vendor/cordis`](file:///j:/limiar/packages/lynxfita/vendor/cordis), [arXiv:2608.25512](https://arxiv.org/abs/2608.25512)) native desktop and embedded runtime for LynxJS built on Static Hermes (`static_h`), C++20 JSI, WIT/WASI components, Stationary DMA, and X.509 mTLS Module Federation.

---

## 1. Progressive Disclosure Architecture

Governance is modularized by subtree. Consult the owning `AGENTS.md` before modifying any directory:

```
[Repository Root] AGENTS.md (Standing Orders & Capability Seam Contract)
       │
       ├── docs/AGENTS.md (Tier Taxonomy, dsh-prose-standard, Archify Diagrams & OKF)
       ├── packages/AGENTS.md (Cordis Capability Seams, WIT Codegen, Builder & mTLS Updater)
       ├── src/native/AGENTS.md (C++20 NativeContext, Dynamic .dll/.so/.dylib Loader & DMA Arena)
       ├── vendor/AGENTS.md (Zero-Fork Pinned Submodules & Atomic Patch Manager)
       ├── benchmarks/AGENTS.md (Kalibera & Jones Statistical Benchmarking Methodology)
       ├── examples/AGENTS.md (Multi-Platform LynxFita Explorer & Weather Showcase MVI)
       └── .agents/ (Specialist Profiles & Executable Skills: archify, dsh-prose-standard, record-browser-gif)
```

| Subtree | Governance Scope | Authoritative Indexer |
| :--- | :--- | :--- |
| **Documentation & Prose** | Tier taxonomy, `dsh-prose-standard`, Archify specs, transcripts | [`docs/AGENTS.md`](file:///j:/limiar/packages/lynxfita/docs/AGENTS.md) |
| **TypeScript Workspaces** | `@lynxfita/core`, `codegen`, `wasi-runtime`, `builder`, `updater`, `cli` | [`packages/AGENTS.md`](file:///j:/limiar/packages/lynxfita/packages/AGENTS.md) |
| **Native C++20 Engine** | `NativeContext`, `LoadLibraryExW`/`dlopen` FFI, Stationary DMA, Static Hermes | [`src/native/AGENTS.md`](file:///j:/limiar/packages/lynxfita/src/native/AGENTS.md) |
| **Vendor Submodules** | 10 pinned upstream submodules (`cordis`, `hermes`, `lynx`, `kernels`, etc.) | [`vendor/AGENTS.md`](file:///j:/limiar/packages/lynxfita/vendor/AGENTS.md) |
| **Statistical Benchmarks** | Warm-up convergence, $N \ge 30$ samples, $p50/p95/p99$, IQR, CV%, 95% CI | [`benchmarks/AGENTS.md`](file:///j:/limiar/packages/lynxfita/benchmarks/AGENTS.md) |
| **Explorer & Examples** | Super-App `examples/explorer/`, `weather-showcase`, HMR & FFmpeg capture | [`examples/AGENTS.md`](file:///j:/limiar/packages/lynxfita/examples/AGENTS.md) |
| **Skills & Profiles** | `archify`, `dsh-prose-standard`, `record-browser-gif`, `codegen-jsi`, `native-build-test` | [`.agents/`](file:///j:/limiar/packages/lynxfita/.agents) |

---

## 2. Core Engineering & Architectural Invariants

### A. Everything Is a Cordis Plugin (Endogenous Runtime Spine)
- Following [`aleffita/deepseek-harness`](https://github.com/aleffita/deepseek-harness) and [`vendor/cordis`](file:///j:/limiar/packages/lynxfita/vendor/cordis), every runtime capability is a **Capability Seam** comprising a **Service Definition**, **Service Provider**, and **Consumer** mounted on a unified `Context` (`LynxFitaContext` in TypeScript and `lynxfita::cordis::NativeContext` in C++20):
  - `ctx.dma`: 64B-aligned Stationary DMA arena + PPE/SPE ring lanes + SIMD reductions.
  - `ctx.protobuf`: Zero-JSON binary wire framing over `ctx.dma`.
  - `ctx.compiler`: Static Hermes ahead-of-time (`.hbc`) and runtime JIT/AOT compiler.
  - `ctx.ffi`: Cross-platform dynamic native library loader (`.dll` via `LoadLibraryExW`, `.so`/`.dylib` via `dlopen`) with automatic `FreeLibrary`/`dlclose` on Fiber `_unload()`.
  - `ctx.wasi`: WIT (WebAssembly Interface Types) universal module IR and sandboxed WASI host bound to `ctx.dma`.
  - `ctx.gpu`: W3C WebGPU two-buffer staging + WGSL compute shaders + `huggingface/kernels`.
  - `ctx.authority`: Real `node:tls` X.509 mTLS Authority Server (`requestCert: true`), role-bearing client certificates (`viewer`, `top-patron`, `canary`), and live Certificate Revocation List (CRL).
  - `ctx.federation`: Bundler Module Federation & OTA reconciler (embedded installation bundle vs. remote federated bundle) with live certificate revocation rollback (`Fiber._unload()`).
- **Registrations Are Revertible Effects**: Every resource registration goes through `ctx.effect()` or generator `yield` and returns a disposer so reload and teardown unwind in LIFO order.

### B. Zero Polling, Single Atomic Commands & Anti-Reward-Hacking
- **Zero Polling**: Never poll background tasks or subagents; rely strictly on Reactive Wakeup.
- **Single Atomic Commands**: Never chain shell commands with `;`, `&&`, or `||`.
- **Zero Mocks / Zero Reward Hacking**: Never fake mTLS/RBAC with string tokens (`MTLS_AUTH_TOKEN_...`), never hardcode benchmark results, and never weaken test assertions.

### C. DeepSeek-Harness Prose Standard (`dsh-prose-standard`) & Visual Evidence
- Write direct, factual contracts using [`dsh-prose-standard`](file:///j:/limiar/packages/lynxfita/.agents/skills/dsh-prose-standard/SKILL.md). Never use AI-slop buzzwords (`"industrial port"`, `"v2.0 Architecture"`, `"advance the frontier"`, `"state-of-the-art"`).
- Compile all architecture and sequence diagrams via [`archify`](file:///j:/limiar/packages/lynxfita/.agents/skills/archify/SKILL.md) (`.agents/skills/archify/SKILL.md`) and record all UI demos from live browser execution via [`record-browser-gif`](file:///j:/limiar/packages/lynxfita/.agents/skills/record-browser-gif/SKILL.md) + FFmpeg.

### D. Coordinator Ultimate Liability & Strict Gitflow
- The Principal Coordinator bears 100% liability for all subagent actions, diffs, and CI gates.
- All changes flow through tracked GitHub Issues (`Closes #N`) on `feature/*` or `fix/*` branches into `develop` and `main`, with mandatory adversarial review (`CordisAdversarialAuditor`) and immediate dead-branch deletion (`delete_branch_on_merge = true`).
