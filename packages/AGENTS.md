---
type: protocol
title: "AGENTS.md — TypeScript Workspaces & Cordis Capability Seams"
description: "Governance rules for LynxFita TypeScript packages (@lynxfita/core, codegen, wasi-runtime, builder, updater, cli)."
tags:
  - packages
  - cordis
  - capability-seam
  - wit-codegen
  - mtls
  - module-federation
timestamp: 2026-11-05
status: active
author: aleffita
---

# AGENTS.md — TypeScript Workspaces

This directory contains the public SDK and tooling packages published under `@aleffita/lynxfita-*` on GitHub Packages and linked locally as `@lynxfita/*` via `scripts/setup-workspace.mjs`.

## Workspace Responsibilities & Cordis Seams

| Package | Owning Cordis Service(s) | Responsibility |
| :--- | :--- | :--- |
| **[`@lynxfita/core`](file:///j:/limiar/packages/lynxfita/packages/core)** | `LynxFitaContext`, `ctx.dma`, `ctx.protobuf`, `ctx.compiler`, `ctx.ffi`, `ctx.gpu` | Endogenous Cordis `Context`, `Fiber`, `Service`, `Registry`, Stationary DMA ring, W3C WebGPU staging + WGSL shaders, and `huggingface/kernels` registry. |
| **[`@lynxfita/codegen`](file:///j:/limiar/packages/lynxfita/packages/codegen)** | WIT / Module IR Compiler | Parses WIT (WebAssembly Interface Types) and TypeScript module specs into typed Cordis `Service` definitions, C++20 JSI `HostObject` headers, and Stationary DMA offset layouts. |
| **[`@lynxfita/wasi-runtime`](file:///j:/limiar/packages/lynxfita/packages/wasi-runtime)** | `ctx.wasi` (`WasiComponentService`) | Mounts `.wasm` modules and WIT component bindings onto `LynxFitaContext` with direct zero-copy views into `ctx.dma` and capability-scoped filesystem/device descriptors. |
| **[`@lynxfita/builder`](file:///j:/limiar/packages/lynxfita/packages/builder)** | Bundler & HMR Dev Server | Builds Static Hermes `.hbc` bundles, emits `federation-manifest.json` for Module Federation (embedded baseline vs. remote chunks), and serves local HMR over WebSocket/SSE. |
| **[`@lynxfita/updater`](file:///j:/limiar/packages/lynxfita/packages/updater)** | `ctx.authority`, `ctx.federation` | Real `node:tls` X.509 mTLS Authority Server (`requestCert: true`, RBAC roles `viewer`/`top-patron`/`canary`, live CRL revocation ledger) and Module Federation/OTA reconciler with automatic Cordis Fiber rollback on certificate revocation. |
| **[`@lynxfita/cli`](file:///j:/limiar/packages/lynxfita/packages/cli)** | CLI (`lynxfita`) | Cross-platform developer entrypoint (`doctor`, `build`, `explore`, `dev`, `codegen`, `bench`). |

## Rules

1. **Every Capability Is a Seam**: Never export standalone stateful classes without a corresponding Cordis `Service` provider that registers on `LynxFitaContext` and cleans up via `ctx.effect()`.
2. **Preserve `exFAT` Proxy Stubs**: Always run `node scripts/setup-workspace.mjs` after adding or modifying package entrypoints so cross-package resolution succeeds on `exFAT` volumes.
