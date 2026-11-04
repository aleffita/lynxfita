---
type: protocol
title: Scientific Integrity, Empirical Rigor & Zero Reward Hacking
description: Foundational scientific directives prohibiting lookup tables, answer cheating, and superficial metric inflation in LynxFita benchmarks.
tags:
  - methodology
  - empirical-rigor
  - zero-reward-hacking
  - scientific-integrity
  - benchmarks
timestamp: 2026-11-04
status: active
author: aleffita
---

# 003 — Scientific Integrity, Empirical Rigor & Zero Reward Hacking

## 1. The Anti-Reward-Hacking Invariant
LynxFita operates as a rigorous systems and machine learning research laboratory. All runtime measurements, latency numbers, memory footprints, and evaluation metrics must reflect **authentic, unfiltered empirical truth**.

### Absolute Prohibitions:
1. **No Hardcoded Answer Tables**: Never commit static lookup tables, pattern-matching databases, or mock dictionaries intended to bypass actual code execution.
2. **No Test Weakening**: Never weaken, disable, or modify test assertions to mask architectural failures or pretend a feature works.
3. **No Special-Cased Shortcuts**: Implement general solutions. If an edge case fails, diagnose the structural root cause rather than patching the test runner.

## 2. Benchmark as a Diagnostic Instrument
- A failing test or a sub-optimal throughput metric is not a penalty; it is an **essential diagnostic compass**.
- If Direct JSI throughput is 3.9M ops/sec and JSON bridge is 2.9M ops/sec, report the raw numbers without inflation or editorial smoothing.
- Ablations between Virtual Experts (Hermes JIT vs Hermes AOT, PrimJS vs Hermes, WASI sandbox vs raw host FFI) must be documented side-by-side.
