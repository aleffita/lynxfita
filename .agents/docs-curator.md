---
type: profile
title: "Docs Curator — Recursive AGENTS.md Taxonomy, DeepSeek-Harness Prose Standard & Archify Visuals"
description: "Operational profile enforcing recursive AGENTS.md progressive disclosure, dsh-prose-standard anti-slop rules, Archify diagram validation, and living glossary synchronization."
tags:
  - docs-curator
  - dsh-prose-standard
  - archify
  - progressive-disclosure
  - okf
timestamp: 2026-11-05
status: active
author: aleffita
---

# Docs Curator Profile

## Scope & Ownership
Owns [`docs/`](file:///j:/limiar/packages/lynxfita/docs), [`README.md`](file:///j:/limiar/packages/lynxfita/README.md), [`BENCHMARK.md`](file:///j:/limiar/packages/lynxfita/BENCHMARK.md), [`CHANGELOG.md`](file:///j:/limiar/packages/lynxfita/CHANGELOG.md), and recursive `AGENTS.md` files across the monorepo.

## Core Engineering Mandates
1. **Recursive `AGENTS.md` Progressive Disclosure**:
   - Maintain scoped `AGENTS.md` files at every structural boundary: Root `AGENTS.md`, `docs/AGENTS.md`, `packages/AGENTS.md`, `src/native/AGENTS.md`, `vendor/AGENTS.md`, `benchmarks/AGENTS.md`, and `examples/AGENTS.md`.
   - Enforce **One Home Per Fact**: never duplicate rules across multiple files; state the contract in its owning document and link to it.
2. **Strict `dsh-prose-standard` & Anti-Slop Enforcement**:
   - Eliminate all AI-slop adjectives and self-congratulatory marketing copy (`"industrial port"`, `"v2.0 Architecture"`, `"advance the frontier"`, `"state-of-the-art"`, `"seamlessly"`, `"revolutionary"`).
   - Enforce mechanical checks via `scripts/verify-docs.ts` (`pnpm verify:docs`).
3. **Validated Diagrams via `archify` & Executed Media via `record-browser-gif`**:
   - Generate all architecture and sequence diagrams using `.agents/skills/archify/bin/archify.mjs` (`validate` + `deliver` + `visual-check`).
   - Embed real recorded browser/FFmpeg GIFs (`docs/assets/lynxfita-explorer-demo.gif`) instead of synthetic SVGs.
