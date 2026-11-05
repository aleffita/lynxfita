---
type: protocol
title: "AGENTS.md — Examples & Multi-Platform LynxFita Explorer"
description: "Governance rules for LynxFita example applications and the Super-App Explorer modeled on vendor/lynx/explorer."
tags:
  - examples
  - explorer
  - weather-showcase
  - mvi
  - hmr
timestamp: 2026-11-05
status: active
author: aleffita
---

# AGENTS.md — Examples & LynxFita Explorer

This directory owns runnable consumer applications built atop the endogenous Cordis spine (`@lynxfita/core`, `@lynxfita/wasi-runtime`, `@lynxfita/builder`, `@lynxfita/updater`).

## Subtree Layout

- [`examples/explorer/`](file:///j:/limiar/packages/lynxfita/examples/explorer): Multi-platform Super-App Explorer modeled on [`vendor/lynx/explorer`](file:///j:/limiar/packages/lynxfita/vendor/lynx/explorer), containing:
  - `homepage/`: Host shell, showcase switcher, live Cordis Fiber tree inspector, DMA hex telemetry viewer (`0x0000`, `0x1000`, `0x2000`), and interactive X.509 mTLS Certificate / Module Federation controls.
  - `showcase/`: Hosted federated micro-frontends and native WIT/WASI/FFI showcases.
- [`examples/weather-showcase/`](file:///j:/limiar/packages/lynxfita/examples/weather-showcase): Model-View-Intent (MVI) port of [`aleffita/weather-showcase`](https://github.com/aleffita/weather-showcase) consuming `ctx.dma` (`0x2000`), `ctx.gpu` (W3C WebGPU staging + `weather_atmosphere.wgsl`), and `ctx.ffi` (`lynxfita_weather_simd_plugin`).

## Rules

1. **Cordis Consumer Discipline**: Example applications MUST consume runtime capabilities exclusively via Cordis dependency injection (`inject: ['dma', 'gpu', 'ffi', 'federation']`). Never instantiate low-level engine classes directly in UI components.
2. **Cross-Platform Dev & HMR Workflow**: Every example must run cleanly via `pnpm explore` / `pnpm dev` across Windows, Linux, and macOS without requiring platform-specific `.exe` invocations.
3. **Real Visual Evidence (`record-browser-gif`)**: Any UI change in `examples/` updates `docs/assets/lynxfita-explorer-demo.gif` and `.mp4` recorded from the live dev server via headless Chrome and FFmpeg.
