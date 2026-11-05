---
type: protocol
title: "AGENTS.md — TypeScript Workspaces & Cordis Capability Seams"
description: "Governance rules for LynxFita TypeScript packages (@lynxfita/core, codegen, wasi-runtime, builder, updater, cli)."
tags:
  - packages
  - cordis
  - capability-seam
  - wit-codegen
  - ed25519
  - module-federation
timestamp: 2026-11-05
status: active
author: aleffita
---

# AGENTS.md — TypeScript Workspaces

This directory contains the public SDK and tooling packages published under `@aleffita/lynxfita-*` on GitHub Packages and linked locally as `@lynxfita/*` via `scripts/setup-workspace.ts`.

## Workspace Responsibilities & Cordis Seams

| Package | Owning Cordis Service(s) | Responsibility |
| :--- | :--- | :--- |
| **[`@lynxfita/core`](file:///j:/limiar/packages/lynxfita/packages/core)** | `LynxFitaContext`, `ctx.dma`, `ctx.protobuf`, `ctx.compiler`, `ctx.ffi`, `ctx.gpu` | Endogenous Cordis `Context`, `Fiber`, `Service`, `Registry`, Stationary DMA ring, W3C WebGPU staging + WGSL shaders, and `huggingface/kernels` registry. |
| **[`@lynxfita/codegen`](file:///j:/limiar/packages/lynxfita/packages/codegen)** | WIT / Module IR Compiler | Parses WIT (WebAssembly Interface Types) and TypeScript module specs into typed Cordis `Service` definitions, C++20 JSI `HostObject` headers, and Stationary DMA offset layouts. |
| **[`@lynxfita/wasi-runtime`](file:///j:/limiar/packages/lynxfita/packages/wasi-runtime)** | `ctx.wasi` (`WasiComponentService`) | Mounts `.wasm` modules and WIT component bindings onto `LynxFitaContext` with direct zero-copy views into `ctx.dma` and capability-scoped filesystem/device descriptors. |
| **[`@lynxfita/builder`](file:///j:/limiar/packages/lynxfita/packages/builder)** | Bundler & Packager | Builds Static Hermes `.hbc` bundles, packages self-contained executables and bundles, emits `release.manifest.json` and Ed25519 signatures for release integrity, and serves local dev HMR. |
| **[`@lynxfita/updater`](file:///j:/limiar/packages/lynxfita/packages/updater)** | `ctx.federation` | Ed25519 release integrity, SHA-256 payload verification, GitHub Releases integration, and Module Federation/OTA reconciler with automatic Cordis Fiber rollback to embedded baseline on signature mismatch. |
| **[`@lynxfita/cli`](file:///j:/limiar/packages/lynxfita/packages/cli)** | CLI (`lynxfita`) | Cross-platform developer entrypoint (`doctor`, `build`, `pack`, `init`, `explore`, `dev`, `codegen`, `bench`). |

## Rules

1. **Every Capability Is a Seam**: Never export standalone stateful classes without a corresponding Cordis `Service` provider that registers on `LynxFitaContext` and cleans up via `ctx.effect()`.
2. **Preserve `exFAT` Proxy Stubs**: Always run `node --experimental-strip-types scripts/setup-workspace.ts` after adding or modifying package entrypoints so cross-package resolution succeeds on `exFAT` volumes.
