---
type: concept
title: LynxFita Master Ontology & Living Research Glossary
description: Living taxonomic and ontological reference defining core terminology, acronyms, and runtime concepts in the LynxFita ecosystem.
tags:
  - ontology
  - glossary
  - taxonomy
  - concepts
timestamp: 2026-11-04
status: active
author: aleffita
---

# LynxFita Master Ontology & Living Research Glossary

| Term | Domain | Definition in LynxFita |
| :--- | :--- | :--- |
| **JSI (JavaScript Interface)** | Runtime Boundary | A lightweight, general-purpose C++ abstraction layer originated by Meta (`facebook::jsi`) allowing host C++ code to interact directly with a JavaScript engine without intermediate marshaling or JSON serialization. |
| **Static Hermes (`static_h`)** | Engine Architecture | Meta's ahead-of-time optimizing compiler and runtime for Hermes, compiling typed JS/TS into optimized native code and deterministic bytecode (`.hbc`). Default branch of `meta/hermes`. |
| **PrimJS** | Lynx Engine Core | ByteDance's lightweight JavaScript/Lepus runtime engine tailored for Lynx's template assembler (TASM) and layout scripting. Preserved intact in LynxFita. |
| **Lynxtron** | Desktop Platform | ByteDance's open-source framework fusing Node.js and Lynx for desktop applications, historically relying on Chromium content shell and JSON IPC pipes. |
| **Sparkling** | Native Platform SDK | ByteDance / TikTok's modular cross-platform framework (analogous to Expo for React Native) providing scheme routing, native modules, and `spkPipe`. |
| **Lepus** | Lynx Scripting | Lynx's dual-threaded scripting engine responsible for fast, low-latency UI animation and template manipulation without blocking the main JS thread. |
| **TASM (Template Assembler)** | UI Rendering | Lynx's native binary template decoder and virtual DOM reconstruction engine, powering high-performance cross-platform view trees. |
| **WASI (WebAssembly System Interface)** | Sandbox IR | Standardized modular system interface providing portable, capability-based OS primitives (filesystem, clocks, random) for WebAssembly modules. |
| **WASIX** | Sandbox Extension | Superset of WASI adding POSIX multi-threading, sockets, process control, and memory mapping to WebAssembly. |
| **Bridge Sequestration** | Migration Strategy | Coexistence architectural pattern where legacy JSON message queue calls (`spkPipe`, `NativeModules`) are transparently intercepted and routed over direct C++ JSI HostObjects. |
| **Open Knowledge Format (OKF)** | Agentry & Docs | Google specification structuring organizational knowledge as portable Markdown files with standardized YAML frontmatter metadata. |
| **Zero Reward Hacking** | Scientific Integrity | Research directive strictly prohibiting static lookup tables, benchmark prompt interception, or artificial score inflation. |
| **Element Interconnect Bus (EIB)** | Hardware & DMA Architecture | Interconnect bus topology originated in the Sony/IBM/Toshiba PlayStation 3 Cell Broadband Engine (CBE), featuring circular, counter-rotating data rings connecting PPE controller and SPE vector coprocessors with dedicated DMA lanes. Adapted in LynxFita for zero-copy memory routing. |
| **Stationary Memory & DMA Lanes** | Memory Architecture | Pre-allocated, pinned physical memory regions that remain stationary, bypassed by direct memory access (DMA) transfers between host and background worker threads, eliminating Von Neumann memory copying bottlenecks. |
| **Non-Colored Coroutines** | Concurrency Model | Fiber/coroutine execution using iterator `yield` semantics, eliminating the red/blue function divide of async/await while providing true non-blocking concurrency without a Global Interpreter Lock (GIL). |
| **CORDIS Composability** | Software Architecture | Paradigm from arXiv:2608.25512 establishing spatiotemporal composability through revertible effects (temporal rollback) and reactive coeffects (spatial environment context) within a managed plugin ledger. |
| **Revertible Effects** | Temporal Composability | Execution modifications that record runtime inverses, enabling seamless state rollback and cleanup when a plugin or bundle is unloaded. |
| **Reactive Coeffects** | Spatial Composability | Declared ambient context requirements that dynamically control the activation and deactivation of components based on environmental readiness. |
| **Protobuf Binary Bridge** | Serialization Protocol | Lightweight header-only Protocol Buffer binary wire-format encoder/decoder integrated into the JSI bridge, enabling microsecond serialization for legacy calls without JSON string allocations. |
| **Hugging Face Kernels** | Accelerated Compute | High-performance WebGPU, SIMD, and native hardware compute kernels dynamically loaded and executed for tensor and matrix operations without blocking runtime event loops. |
| **Module Federation Super-App** | Bundle Architecture | High-level host shell capable of dynamically mounting, verifying, and executing independent Hermes bytecode bundles via a unified spatiotemporal ledger inspired by REPACK. |
