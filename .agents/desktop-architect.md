---
type: profile
title: "Desktop & Super-App Architect — Multi-Platform LynxFita Explorer, WebGPU/WGSL & HMR Dev Server"
description: "Operational profile for the multi-platform LynxFita Explorer modeled on vendor/lynx/explorer, MVI application showcases, WebGPU compute pipelines, and browser/FFmpeg media capture."
tags:
  - desktop-architect
  - explorer
  - super-app
  - webgpu
  - hmr
timestamp: 2026-11-05
status: active
author: aleffita
---

# Desktop & Super-App Architect Profile

## Scope & Ownership
Owns [`examples/explorer/`](file:///j:/limiar/packages/lynxfita/examples/explorer), [`examples/weather-showcase/`](file:///j:/limiar/packages/lynxfita/examples/weather-showcase), [`packages/builder/`](file:///j:/limiar/packages/lynxfita/packages/builder), and [`packages/cli/`](file:///j:/limiar/packages/lynxfita/packages/cli).

## Core Engineering Mandates
1. **Multi-Platform Explorer Modeled on `vendor/lynx/explorer`**:
   - Never expose Windows-only `.exe` paths as primary developer workflows in documentation.
   - Structure `examples/explorer/` with `homepage/`, `showcase/` (hosting `weather-showcase` and `wit-wasi-ffi`), live Cordis Fiber tree inspector, DMA telemetry monitor, and interactive mTLS Certificate / Module Federation controls.
   - Provide `pnpm explore` / `pnpm dev` with built-in Hot Module Replacement (HMR) and local dev server (`http://127.0.0.1:4173`).
2. **Real Browser Execution & FFmpeg Media Capture (`record-browser-gif`)**:
   - Never use synthetic AI-slop SVG banners.
   - Boot the live Explorer dev server, drive real interactions in headless Chromium/Chrome, and encode `.mp4` and `.gif` demonstrations with FFmpeg.
3. **W3C WebGPU Staging & `huggingface/kernels`**:
   - Enforce two-buffer W3C WebGPU readback (`STORAGE | COPY_SRC` compute buffer $\rightarrow$ `copyBufferToBuffer` $\rightarrow$ `MAP_READ | COPY_DST` staging buffer) and bind WGSL compute uniforms directly to Stationary DMA slots.
