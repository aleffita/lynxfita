---
type: architecture
title: Dynamic Hermes AOT Over-The-Air (OTA) Updates & Bypassing Electron Updaters
description: Architectural design for streaming AOT Hermes bytecode bundles dynamically, eliminating full desktop installer reinstalls.
tags:
  - architecture
  - ota
  - hermes-aot
  - bytecode
  - electron-updater
  - rbac
timestamp: 2026-11-04
status: active
author: aleffita
---

# 005 — Dynamic Hermes AOT OTA Updates & Bypassing Electron Updaters

## 1. The Heavyweight Desktop Updater Dilemma
In traditional desktop frameworks (Electron, Lynxtron with standard Electron Builder):
- Every application update requires downloading a 80MB–150MB installer or differential binary.
- Installing updates requires elevating UAC, killing running processes, replacing executable binaries on disk, and restarting the entire application.
- Minor bug fixes take days to deploy across an enterprise fleet.

## 2. Dynamic Hermes Bytecode Streaming (OTA)
Because Hermes compiles JavaScript and TypeScript into standalone Ahead-Of-Time bytecode bundles (`.hbc`), updates to business logic and UI templates can be delivered over-the-air (OTA) **without modifying the host native executable**:

```
+----------------------------------------------------------------------------------------------------+
|                                    OTA Delivery Architecture                                       |
|                                                                                                    |
|    +----------------------+                                     +-------------------------------+  |
|    |  LynxFita OTA Cloud  |                                     |    LynxFita Desktop Client    |  |
|    |  - Version Registry  |                                     |  - HermesRuntimeSession       |  |
|    |  - Cryptographic Sig | ===== Stream Delta (.hbc) =======>  |  - Signature Verification     |  |
|    |  - RBAC Policy Engine|                                     |  - In-Memory Bytecode Reload  |  |
|    +----------------------+                                     +-------------------------------+  |
|                                                                                 |                  |
|                                                                                 v                  |
|                                                                 +-------------------------------+  |
|                                                                 |      Active Lynx UI View      |  |
|                                                                 |  (Instant Zero-Downtime Swap) |  |
|                                                                 +-------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

## 3. Targeted Delivery & Fingerprinting
1. **RBAC & Feature Toggling**: The OTA update engine evaluates the client's role-based access control token (RBAC) and hardware capability profile (CPU topology, SIMD support) to stream tailored bytecode bundles.
2. **Cryptographic Verification**: Every received `.hbc` bundle is verified against a SHA-256 digest and public key signature before invocation.
3. **Rollback Resilience**: If a new bundle throws an uncaught exception during initialization, the host automatically rolls back to the last known healthy bytecode bundle stored in the local cache.
