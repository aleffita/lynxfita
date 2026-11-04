---
type: protocol
title: "LynxFita Gitflow & Pull Request Governance Model"
description: Branching model, semantic versioning rules, pull request requirements, and multi-agent code review protocols for the LynxFita research repository.
tags:
  - gitflow
  - governance
  - semver
  - pull-requests
  - protocol
timestamp: 2026-11-04
status: active
author: aleffita
---

# LynxFita Gitflow & PR Governance Model

## 1. Branch Topology

The repository follows an enterprise-grade Gitflow branching model calibrated for autonomous agent swarms and human tech lead oversight:

```
[production]   main ──────────────────────────────● (v1.0.0 Tag)
                 ▲                                │
                 │ (release PR)                   │ (hotfix backport)
[staging]      develop ───●───────────●───────────▼
                 ▲        │           │
                 │        │ (fork)    │
[feature]        │        ▼           ▼
               feature/eib-dma   feature/cordis-ledger
```

### Branch Roles
- **`main`**: Production trunk. Protected branch. Code in `main` is always deployable, passes all CI validations (Native C++, TypeScript, Submodules), and carries signed SemVer tags (`vMAJOR.MINOR.PATCH`). Direct pushes are restricted; changes land strictly via Pull Requests with passing CI checks.
- **`develop`**: Integration branch for upcoming releases. Features and bug fixes merge into `develop` first.
- **`feature/<name>`**: Dedicated work branches for specific functional additions, architectural refactors, or research papers. Created from `develop` and merged back via Pull Request.
- **`release/<version>`**: Stabilization branch for release candidate hardening (e.g., `release/v1.0.0`). Merged into `main` (with release tag) and back into `develop`.
- **`hotfix/<name>`**: Emergency fixes branched directly from `main` and merged into both `main` and `develop`.

---

## 2. Semantic Versioning (SemVer 2.0.0)

LynxFita strictly observes [SemVer 2.0.0](https://semver.org/):
- **MAJOR** (`vX.0.0`): Incompatible API breaks, JSI HostObject signature alterations, or WASI ABI changes.
- **MINOR** (`v0.X.0`): Backwards-compatible feature additions (new C++ modules, new codegen targets, CORDIS plugins, Hugging Face kernel integrations).
- **PATCH** (`v0.0.X`): Backwards-compatible bug fixes, performance optimizations, and documentation alignments.

---

## 3. Pull Request Requirements & Checklist

Every Pull Request submitted to LynxFita MUST adhere to the following non-negotiable invariants:

1. **Focused Atomic Diffs**: No monolithic PRs mixing unrelated refactors with feature work.
2. **Deep Verification**: Must include empirical test execution traces from both `pnpm test` and `scripts\test-native.cmd` (or `ctest`).
3. **No Weakened Assertions**: Existing test assertions must not be modified or skipped to simulate green status.
4. **Submodule Cleanliness**: All vendored submodules in `vendor/` must remain clean and aligned with zero untracked diffs, managed solely via atomic patches in `patches/`.
5. **OKF Compliance**: Any new research insights, architectural paradigms, or feedback transcripts must be committed with valid YAML frontmatter.

---

## 4. GitHub Issue & Project Board Governance

Work tracking utilizes GitHub Projects and Issues:
- **Triage**: High-priority tasks derived from principal feedback are indexed with labels `status:ready`, `type:architecture`, `priority:p0`.
- **Kanban Stages**: `Backlog` -> `In Progress` -> `In Review (PR Open)` -> `Verified` -> `Merged / Closed`.
- **Agent Roles**: Worker agents execute atomic steps on designated feature branches; review agents verify diffs and test suites before PR approval.
