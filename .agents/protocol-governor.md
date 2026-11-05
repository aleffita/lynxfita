---
type: profile
title: "Protocol Governor — X.509 mTLS Authority, Bundler Module Federation, Anti-Reward-Hacking & Gitflow"
description: "Operational profile governing cryptographic mTLS/RBAC authority verification, bundler federation reconciliation, adversarial QA gates, and Gitflow traceability."
tags:
  - protocol-governor
  - mtls
  - rbac
  - module-federation
  - gitflow
  - qa
timestamp: 2026-11-05
status: active
author: aleffita
---

# Protocol Governor Profile

## Scope & Ownership
Owns [`packages/updater/`](file:///j:/limiar/packages/lynxfita/packages/updater), [`packages/builder/`](file:///j:/limiar/packages/lynxfita/packages/builder), [`.github/workflows/`](file:///j:/limiar/packages/lynxfita/.github/workflows), and repository-wide QA/security gates.

## Core Engineering Mandates
1. **Real X.509 mTLS Authority Server & Certificate Revocation (`ctx.authority`)**:
   - Zero simulated token strings (`MTLS_AUTH_TOKEN_...` is strictly forbidden).
   - Must run a real `node:tls` / `node:https` server (`requestCert: true`, `rejectUnauthorized: true`) backed by real X.509 Root CA, Server Certificate, and role-bearing Client Certificates (`viewer`, `top-patron`, `canary`) plus a live Certificate Revocation List (CRL).
2. **Bundler Module Federation & Runtime AOT Reconciliation (`ctx.federation`)**:
   - Module Federation connects `@lynxfita/builder` (manifest & chunk generation) with `@lynxfita/updater` and `ctx.compiler` (Runtime AOT).
   - Reconciles the **embedded installation bundle** against **remote federated/OTA bundles** (`@aleffita/lynxfita-bundle-*` or mTLS Authority Server).
   - Enforces RBAC by client certificate role (`viewer` receives `stable`; `top-patron`/`canary` receives `canary`; unauthorized role receives `403`).
   - Enforces **Live Certificate Revocation Rollback**: revoking a client certificate immediately invalidates the active remote bundle, invokes Cordis `Fiber._unload()` to unwind all effects in LIFO order, and restores the embedded installation bundle.
3. **Post-Release & End-to-End Regression Gates**:
   - Every release and PR must pass unit, integration, e2e (real TLS mTLS handshake + cert revocation + runtime AOT + native `.dll`/`.so` load/unload), and documentation/prose verification (`pnpm verify:docs`).
