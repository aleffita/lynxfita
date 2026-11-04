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

### F. Epistemic Feedback Decoupage & Anti-Premature Ingestion
- When receiving feedback dumps from the principal, **NEVER** start assembling a task list prematurely while reading early sentences.
- The principal is Twice-Exceptional (2e) with non-linear, topological thinking. Ingest the entire text verbatim into `docs/transcripts/`, synthesize dialectically, cross-reference empirical sources, and only then derive atomic execution tasks.

### G. Stationary Memory & DMA Lanes (CBE EIB Paradigm)
- Treat memory hierarchically and heterogeneously, inspired by the Cell Broadband Engine (CBE) Element Interconnect Bus (EIB).
- Pre-allocate stationary pinned buffers and communicate across PPE (Host) and SPE (Worker) lanes via bidirectional DMA rings and SIMD vector packing, eliminating Von Neumann bus saturation and redundant JSON allocations.

### H. Zero-GIL Multithreading & Non-Colored Coroutines
- Concurrency must not force function coloring (red/blue async functions) or Global Interpreter Lock (GIL) contention.
- Utilize native fiber coroutines with iterator/`yield` scheduling executed on native background threads with lockless ring buffers.

### I. Spatiotemporal Composability & Dynamic Plugin Ledgers (CORDIS)
- Adopt the CORDIS paradigm: temporal composability via revertible effects (state rollback on deactivation) and spatial composability via reactive coeffects (contextual activation).
- Manage plugins and bundles via a deterministic dependency ledger with hot module reloading.

### J. Public Presentation, Retention & SEO
- Landing pages (`README.md`) must be clean, elegant, high-retention, and SEO-friendly.
- **NEVER** dump gigantic, unstyled diagrams onto the main README. Isolate in-depth technical diagrams in dedicated `docs/architecture/` artifacts with proper styling and direct links.

### K. Coordinator Ultimate Liability & Pre-Delegation Dialectical Synthesis
- **Strict Command Chain Accountability**: The Principal Coordinator (lead agent) bears **100% of the responsibility** for every action, commit, pipeline trigger, and architectural decision executed by any subagent. If a subagent makes an error, violates Gitflow, or delivers shallow work, the entire team fails and the fault lies squarely on the Coordinator.
- **Zero Blind Forwarding**: The Coordinator MUST NEVER blindly forward a raw user prompt to a worker subagent to "do everything at once".
- **Mandatory Multi-Turn Orchestration**: Before delegating implementation:
  1. The Coordinator must personally perform deep epistemological decoupage and structural analysis of the principal's request.
  2. Dispatch targeted, read-only reconnaissance/verification tasks to subagents first to gather empirical facts.
  3. Reflect on the findings, design the exact architectural specification, branch strategy, and verification gates.
  4. Delegate scoped, atomic work packages on isolated feature branches (`feature/*`) and personally audit every diff and CI status before any merge into `develop` or `main`.
  5. **Mandatory Adversarial Peer-Review Gate**: Every Pull Request opened by an implementation subagent MUST undergo an independent line-by-line code review by a verification subagent (`DeepInvestigator`) checking for hardcodes, simplifications, mocks, or untested paths *before* the Coordinator authorizes merging.

### L. Strict Gitflow & CI/CD Pipeline Discipline (Zero Trunk-Based Spam)
- **Absolute Prohibition of Direct Pushes to `main`**: Agents MUST NEVER push commits directly to `main` (trunk-based commits) or trigger multiple uncoordinated CI/CD runs.
- **Gitflow Branch Hierarchy**:
  - `main`: Production-grade, tagged SemVer releases only (`vX.Y.Z`).
  - `develop`: Integration branch receiving reviewed Pull Requests.
  - `feature/*`, `fix/*`, `release/*`: Working branches where all local commits and local test validations occur *before* a single push.
- **Issue-to-PR Traceability & Zero Stale Issues**: Every feature or fix MUST map to a tracked GitHub Issue (with labels and milestone), and its Pull Request body MUST include explicit GitHub closing keywords (`Closes #N` / `Resolves #N`) so merging the PR automatically resolves and links the Issue. Never leave disconnected or stale Issues open.
- **Dead Branch Pruning & Auto-Delete on Merge**: The repository setting `delete_branch_on_merge` MUST be enforced (`true`), and merged `feature/*`, `fix/*`, and `release/*` branches MUST be deleted immediately after merge both locally (`git branch -d`) and on `origin` (`git push origin --delete` / `gh pr merge --delete-branch`). Never leave dead branches lingering in the repository.
- **Git Worktree Orchestration**: Parallel feature streams MUST use isolated Git worktrees (`git worktree`) or branched workspaces to prevent index locks and cross-branch contamination.
- **Changelog Maintenance**: Every release cycle MUST update [`CHANGELOG.md`](file:///j:/limiar/packages/lynxfita/CHANGELOG.md) with structured SemVer release notes.
- **CI/CD Concurrency & Gatekeeping**: All GitHub Actions workflows MUST enforce `concurrency` cancellation (`cancel-in-progress: true`), path filtering, and strict PR status checks prior to merge.

### M. Releases vs. Packages Distribution Taxonomy
- **GitHub Releases (Multi-Platform Binaries & App Executables)**: Distributes compiled native engine binaries, C++20 headers, and standalone multi-platform application executables (Windows x64, Linux x64, macOS arm64) with cryptographic SHA-256 manifests.
- **GitHub Packages (Modular SDK & OTA AOT Bundles)**: Distributes versioned npm workspace packages (`@aleffita/*` on `npm.pkg.github.com`) and signed Over-The-Air (OTA) AOT application bundles consumed directly by `@lynxfita/updater` without requiring binary reinstallation.

---

## 3. Subagent Specialization Roster

Subagent operational profiles reside in [`.agents/`]:
- [`runtime-specialist.md`](file:///j:/limiar/packages/lynxfita/.agents/runtime-specialist.md): Static Hermes AOT, JSI interfaces, memory bounds, bytecode verification.
- [`desktop-architect.md`](file:///j:/limiar/packages/lynxfita/.agents/desktop-architect.md): Win32 native embedding, Lynxtron shell dichotomy, Chromium GN ninja build hooks.
- [`protocol-governor.md`](file:///j:/limiar/packages/lynxfita/.agents/protocol-governor.md): Epistemic taxonomy, anti-reward-hacking audits, multi-agent coordination governance.
- [`docs-curator.md`](file:///j:/limiar/packages/lynxfita/.agents/docs-curator.md): Open Knowledge Format (OKF) compliance, living glossary synchronization.
