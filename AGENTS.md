---
type: protocol
title: Master Agentry Protocol & Progressive Disclosure Indexer
description: Authoritative master indexer and governance protocol for autonomous and human agents in the LynxFita research monorepo.
tags:
  - agentry
  - protocol
  - progressive-disclosure
  - governance
  - okf
timestamp: 2026-11-04
status: active
author: aleffita
---

# LynxFita Master Agentry Protocol

> [!IMPORTANT]
> This file is the primary entrypoint for any agent (autonomous, pair programmer, or human researcher) operating within the LynxFita ecosystem. It establishes operational boundaries, routing indexers, and non-negotiable scientific invariants.

---

## 1. Progressive Disclosure Architecture

To protect working memory and eliminate token bloat, agentry governance is modularized by domain. Agents MUST NOT dump monolithic rules into chat or maintain giant append-only documents. Consult domain indexers as tasks cross boundaries:

```
[Repository Root] AGENTS.md (Master Indexer & Core Invariants)
       │
       ├── docs/AGENTS.md (Epistemology, OKF Standards, Insights & Living Glossary)
       ├── packages/AGENTS.md (TypeScript Workspaces, JSI Codegen & WASI Host Context)
       ├── src/native/AGENTS.md (C++20 JSI Adapter, Static Hermes & Sandboxed WASI)
       ├── vendor/AGENTS.md (Zero-Fork Pinned Submodules & Atomic Patch Manager)
       └── .agents/ (Domain Specialist Subagents & Executable Skills)
```

### Domain Routing Matrix

| Domain | Governance Scope | Authoritative Indexer |
| :--- | :--- | :--- |
| **Research & Docs** | Epistemic ontology, YAML frontmatter schemas, verbatim transcripts | [`docs/AGENTS.md`](file:///j:/limiar/packages/lynxfita/docs/AGENTS.md) |
| **TypeScript Runtime** | `@lynxfita/core`, `@lynxfita/codegen`, `@lynxfita/wasi-runtime` | [`packages/AGENTS.md`](file:///j:/limiar/packages/lynxfita/packages/AGENTS.md) |
| **Native C++ Engine** | Modern C++20 JSI adapter, `HostObject`, MSVC/CMake/Ninja pipelines | [`src/native/AGENTS.md`](file:///j:/limiar/packages/lynxfita/src/native/AGENTS.md) |
| **Vendor Submodules** | Upstream synchronization, zero-fork tracking, atomic `.patch` flow | [`vendor/AGENTS.md`](file:///j:/limiar/packages/lynxfita/vendor/AGENTS.md) |
| **Specialist Profiles** | Runtime Specialist, Desktop Architect, Protocol Governor, Docs Curator | [`.agents/`](file:///j:/limiar/packages/lynxfita/.agents) |
| **Executable Skills** | Submodule patching, native test runner, codegen, ontology sync | [`.agents/skills/`](file:///j:/limiar/packages/lynxfita/.agents/skills) |

---

## 2. Core Operational Invariants

### A. Zero Polling and Respect for Long-Running Tasks
- **NEVER** poll running processes or tasks.
- Computing tasks, builds, and test runs take time; trust the harness and rely on **Reactive Wakeup**.
- End turns cleanly when tasks run in the background.

### B. Strict Sequential Execution & Single Atomic Commands
- **NEVER** chain commands with semicolons (`;`), logical operators (`&&`, `||`), or multi-step scratch scripts.
- Execute one atomic command at a time, synchronously, inspecting each output before proceeding.

### C. Absolute Anti-Reward-Hacking Directive
- **NEVER** hardcode static lookup tables, pattern-matching databases, or mock answers to pass benchmarks or tests.
- **NEVER** weaken, skip, or delete assertions to fake verification.
- Benchmarks and test suites are diagnostic instruments; report raw empirical numbers plainly.

### D. Principal Feedback Ingestion Directive (Zero Anthropomorphism)
- When principal feedback is received:
  1. **Zero Flattery / Zero Debate**: Never output apologies, self-deprecation, or performative agreements/disagreements.
  2. **Silent Ingestion**: Incorporate feedback directly into persistent behavioral directives and system code.
  3. **Ontological & Epistemic Alignment**: Update [`docs/glossary.md`](file:///j:/limiar/packages/lynxfita/docs/glossary.md) and concept documents when new terminology or perspective shifts are introduced.

### E. Fiduciary Responsibility & Elevation Scoping
- Elevation (UAC) is reserved strictly for operations requiring administrative tokens (e.g., driver configuration, system installations).
- Never elevate for operations achievable within user space.
- Physical handovers (reboots, hardware reconnection, external 2FA) must be cleanly surrendered to the human principal.

---

## 3. Subagent Specialization Roster

Subagent operational profiles reside in [`.agents/`]:
- [`runtime-specialist.md`](file:///j:/limiar/packages/lynxfita/.agents/runtime-specialist.md): Static Hermes AOT, JSI interfaces, memory bounds, bytecode verification.
- [`desktop-architect.md`](file:///j:/limiar/packages/lynxfita/.agents/desktop-architect.md): Win32 native embedding, Lynxtron shell dichotomy, Chromium GN ninja build hooks.
- [`protocol-governor.md`](file:///j:/limiar/packages/lynxfita/.agents/protocol-governor.md): Epistemic taxonomy, anti-reward-hacking audits, multi-agent coordination governance.
- [`docs-curator.md`](file:///j:/limiar/packages/lynxfita/.agents/docs-curator.md): Open Knowledge Format (OKF) compliance, living glossary synchronization.
