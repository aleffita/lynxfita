---
type: protocol
title: TypeScript Packages Domain Agentry Indexer
description: Governance, build standards, and verification protocols for the LynxFita TypeScript workspace packages.
tags:
  - agentry
  - packages
  - typescript
  - indexer
timestamp: 2026-11-04
status: active
author: aleffita
---

# Packages Domain Agentry Indexer

## 1. Domain Governance
This domain covers the core TypeScript workspace packages powering the LynxFita developer experience and runtime abstractions:

### Package Inventory
- [`packages/core`](file:///j:/limiar/packages/lynxfita/packages/core): `@lynxfita/core`
  - `BridgeInterceptor`: Dynamic JSI dispatcher with automatic fallback to `globalThis.NativeModules`.
  - `HermesRuntimeSession`: AOT bundle registration, magic bytecode header verification (`\x1fHBC`), heap configuration.
- [`packages/codegen`](file:///j:/limiar/packages/lynxfita/packages/codegen): `@lynxfita/codegen`
  - `JsiCodeGenerator`: Synthesizes C++20 `HostObject` headers from TypeScript specs, generating dynamic `InvokeMethod` argument unpackers and typed virtual method declarations.
- [`packages/wasi-runtime`](file:///j:/limiar/packages/lynxfita/packages/wasi-runtime): `@lynxfita/wasi-runtime`
  - `WasiHostContext`: Linear WebAssembly memory management, bounds-checking buffer access (`writeBytes`, `readBytes`), string encodings, allocation trap enforcement.

## 2. Invariants for Package Developers
1. **Zero Fake Builds**: Every package MUST compile using genuine `tsc` and emit valid `.d.ts` declaration maps into `dist/`.
2. **Native Node Test Runner**: All unit tests must execute via Node's native test runner (`node --test tests/*.test.mjs`) without external assertion dependencies.
3. **Workspace Discipline**: All workspace packages must interoperate cleanly without failing on exFAT/Windows NTFS junction constraints.
