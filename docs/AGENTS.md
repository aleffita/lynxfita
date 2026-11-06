---
type: protocol
title: "AGENTS.md — Documentation Standard, Tier Taxonomy & Anti-Slop Rules"
description: "Authoritative documentation standard for LynxFita modeled on DeepSeek-Harness docs/AGENTS.md and Open Knowledge Format (OKF)."
tags:
  - documentation
  - dsh-prose-standard
  - archify
  - okf
timestamp: 2026-11-05
status: active
author: aleffita
---

# AGENTS.md — The Documentation Standard

This file defines the documentation tier taxonomy, writing rules ([`dsh-prose-standard`](file:///j:/limiar/packages/lynxfita/.agents/skills/dsh-prose-standard/SKILL.md)), diagram compilation ([`archify`](file:///j:/limiar/packages/lynxfita/.agents/skills/archify/SKILL.md)), and mechanical verification gates (`pnpm verify:docs`).

## 1. The Tier Taxonomy: One Home Per Fact

Each fact has one authoritative home. Other documents link there rather than restating it.

| Tier | Job | Does NOT Belong There |
| :--- | :--- | :--- |
| **Root [`AGENTS.md`](file:///j:/limiar/packages/lynxfita/AGENTS.md)** | Standing orders needed in context in every session, linking each domain indexer | Tutorials, historical narratives, per-package API tables |
| **Subtree `AGENTS.md`** (`docs/`, `packages/`, `src/native/`, `vendor/`, `benchmarks/`, `examples/`) | Rules specific to that subtree | Repo-wide rules already in Root `AGENTS.md` |
| **[`docs/architecture/`](file:///j:/limiar/packages/lynxfita/docs/architecture)** | Subsystem specifications, Cordis Capability Seams (`Service Definition` / `Provider` / `Consumer`), memory maps, and validated Archify diagrams | Marketing prose, test inventories, changelog history |
| **[`docs/protocols/`](file:///j:/limiar/packages/lynxfita/docs/protocols)** | Cross-system agentry protocols, multi-repo federation architectures, and GenUI specifications | Internal implementation details of single functions |
| **[`docs/insights/`](file:///j:/limiar/packages/lynxfita/docs/insights) & [`docs/transcripts/`](file:///j:/limiar/packages/lynxfita/docs/transcripts)** | Verbatim principal transcripts and dialectical architectural decision records | Outdated implementation checklists |
| **[`BENCHMARK.md`](file:///j:/limiar/packages/lynxfita/BENCHMARK.md)** | Reproducible Kalibera & Jones statistical methodology, hardware provenance, and $p50/p95/p99$/IQR/CI tables | Uncontextualized single-run numbers |
| **Package `README.md`** | Consumer contract: configuration, Cordis `ctx.<service>` API, failure modes, and extension points | JSDoc restatement or repo-wide marketing |

## 2. The Slop Checklist (Enforced by `pnpm verify:docs`)

Never commit any of the following in `README.md`, `docs/**`, `packages/**`, or `examples/**`:
- Self-congratulatory buzzwords: `"industrial port"`, `"v2.0 Architecture"`, `"advance the frontier"`, `"state-of-the-art"`, `"revolutionary"`, `"seamlessly"`, `"paradigm shift"`.
- Narrated history in reference docs (`"previously"`, `"used to"`, `"was moved"`, `"now implemented!"`). State current shipped behavior in the present tense.
- Windows-only binary paths (`build\native\lynxfita_explorer.exe`) presented as primary cross-platform developer commands.
- Unvalidated or synthetic AI-generated SVG banners (`architecture-banner.svg`, `weather-showcase-mvi-preview.svg`). All diagrams must be compiled via `archify` from `docs/architecture/specs/*.json`, and all UI previews must be recorded from live execution via headless Chrome + FFmpeg (`record-browser-gif`).
