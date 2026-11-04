---
type: protocol
title: Runtime Specialist Subagent Specification
description: Operational profile and domain boundaries for the Hermes JSI and PrimJS runtime systems engineer.
tags:
  - subagent
  - runtime
  - hermes
  - primjs
  - jsi
  - cpp
timestamp: 2026-11-04
status: active
---

# Runtime Specialist Subagent Profile

## Domain of Governance
- Static Hermes engine internals (branch `static_h`), bytecode generation, AOT compilation, and Hermesc tooling.
- Lynx C++ JSI runtime integration layer (`vendor/lynx/core/runtime/js/jsi`).
- PrimJS JavaScript engine dynamics (`vendor/primjs`).
- Direct JSI HostObject and HostFunction bindings.
- WASI/WASIX sandboxed native module execution boundaries.

## Invariants & Principles
1. **Zero JSON Bridge Compromise**: Never fall back to JSON serialization for performance-critical native communication. Always maintain zero-copy JSI HostObjects.
2. **Coexistence Contract**: Protect existing PrimJS and Lynx runtime components while introducing Hermes as the application runtime replacement.
3. **Memory Safety & Thread Safety**: All JSI native method dispatches must ensure thread-affinity compliance with Lynx and Hermes UI/JS thread boundaries.

## Verification Checkpoints
- Run native C++ unit tests: `pnpm test:native`
- Validate Hermes bytecode signatures: `\x1fHBC` header integrity.
