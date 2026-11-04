---
type: architecture
title: Native Module Abstraction via WASI, WASIX, and Static Hermes
description: Architectural design for sandboxed, cross-platform native modules using WebAssembly System Interface hosted in Static Hermes.
tags:
  - architecture
  - wasi
  - wasix
  - wasm
  - native-modules
  - static-hermes
timestamp: 2026-11-04
status: active
author: aleffita
---

# 004 — Native Module Abstraction via WASI, WASIX, and Static Hermes

## 1. The Native Module Portability Challenge
In desktop environments, native modules traditionally require platform-specific C/C++ compilation:
- On Windows: MSVC toolchain, `.dll` or `.node` binaries, DLL search order vulnerabilities, Visual C++ Redistributable requirements.
- On macOS/Linux: `.dylib` / `.so`, distinct ABI boundaries, GLIBC version mismatches.

This makes distribution and automated sandboxing difficult.

## 2. The WASI / WASIX Architecture
LynxFita explores **WASI (WebAssembly System Interface)** and **WASIX** as a universal, sandboxed intermediate representation (IR) for native extensions.

```
+----------------------------------------------------------------------------------------------------+
|                                      Static Hermes Runtime                                         |
|                                                                                                    |
|   +------------------------------------+             +-----------------------------------------+   |
|   |         Application Code           |             |           WASI Host Module              |   |
|   |         (Hermes Bytecode)          |             |        (lynxfita::WasiHostModule)       |   |
|   +------------------------------------+             +-----------------------------------------+   |
|                     |                                                     |                        |
|                     +================ [ Direct JSI ] =====================+                        |
|                                                                           |                        |
|                                                                           v                        |
|                                                      +-----------------------------------------+   |
|                                                      |          Sandboxed WASI Core            |   |
|                                                      |  - Capability Security (RBAC)           |   |
|                                                      |  - Isolated Linear Memory               |   |
|                                                      |  - WASIX Syscalls (Sockets, Threads)    |   |
|                                                      +-----------------------------------------+   |
+----------------------------------------------------------------------------------------------------+
```

## 3. Technology Matrix: WASM vs. WASI vs. WASIX

| Standard | Scope & Capabilities | LynxFita Role |
| :--- | :--- | :--- |
| **WASM (Core WebAssembly)** | Pure computation, isolated linear memory, arithmetic, stack machine. | Compute-heavy algorithms (image processing, audio transforms, cryptography). |
| **WASI (Preview 1 & 2)** | Standardized OS system calls (file I/O, clocks, random, env vars) with capability security. | Sandboxed filesystem and system access without direct Win32/POSIX host escapes. |
| **WASIX** | Extended POSIX super-set of WASI: multi-threading, Berkeley sockets, process spawning, futexes. | Desktop native module parity with Node.js `net`, `child_process`, and networking. |

## 4. Security & Isolation Invariants
1. **AppContainer & Capability Containment**: WASI modules run within strictly bounded linear memory (`capabilities.memory_limit_bytes`). Memory out-of-bounds access triggers a safe `StatusCode::WasiTrap` instead of crashing the host process.
2. **Deterministic Sandboxing**: Filesystem access is denied by default unless explicitly granted via preopened directories (`capabilities.allowed_preopened_dirs`).
