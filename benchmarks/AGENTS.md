---
type: protocol
title: "AGENTS.md — Statistical Performance Benchmarks"
description: "Governance and statistical methodology for LynxFita microbenchmarks and end-to-end runtime benchmarks following Kalibera & Jones and DeepSeek-Harness."
tags:
  - benchmarks
  - methodology
  - kalibera-jones
  - statistics
timestamp: 2026-11-05
status: active
author: aleffita
---

# AGENTS.md — Performance Benchmarks

This tree owns reproducible repository-level performance benchmarks whose measured paths cross subsystem boundaries (`ctx.dma`, `ctx.protobuf`, `ctx.ffi`, `ctx.wasi`, `ctx.compiler`, `ctx.gpu`).

## Statistical & Methodological Rules (Kalibera & Jones Standard)

1. **Exercise Production Entry Points**:
   - Measure real exports from `@lynxfita/core`, `@lynxfita/wasi-runtime`, and compiled native binaries (`lynxfita_native_tests` / `lynxfita_bench`).
   - Never copy algorithms into benchmark files or report synthetic numbers.
2. **Explicit Warm-Up Convergence Phase**:
   - Execute warm-up iterations before collecting timed samples so JIT caches, OS page tables, and CPU branch predictors reach steady state.
   - Discard warm-up timings completely from statistical aggregates.
3. **Multi-Sample & Multi-Payload Regimes**:
   - Collect $N \ge 30$ independent sample batches across four canonical payload sizes (`64 B`, `4 KB`, `64 KB`, `1 MB`).
4. **Required Statistical Metrics**:
   - Never report a single point estimate or raw average in isolation.
   - Every benchmark output (`benchmarks/results/latest.json` and [`BENCHMARK.md`](file:///j:/limiar/packages/lynxfita/BENCHMARK.md)) MUST report:
     - **Median ($p50$)** and **Interquartile Range (IQR)**
     - **Tail Latencies ($p95$, $p99$)**
     - **Arithmetic Mean ($\mu$)** and **Standard Deviation ($\sigma$)**
     - **Coefficient of Variation ($\text{CV}\% = \sigma / \mu \times 100$)**
     - **95% Confidence Interval ($\pm 1.96 \cdot \sigma / \sqrt{N}$)**
     - **Throughput ($\text{MB/s}$)** and **Heap Memory Delta ($\Delta \text{KiB}$)**
5. **Hardware & Environment Provenance**:
   - Record exact CPU, OS, Node.js version, C++ compiler version, and timestamp in `benchmarks/results/latest.json`.
