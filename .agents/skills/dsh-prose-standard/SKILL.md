---
name: dsh-prose-standard
description: Enforce the DeepSeek-Harness Prose Standard across all Markdown documentation, READMEs, JSDoc, diagnostics, and comments in LynxFita. Eliminates AI-slop buzzwords, reasoning transcripts, and redundant narration while preserving exact technical contracts.
---

# DeepSeek-Harness Prose Standard (LynxFita Adaptation)

Write enough to preserve the technical contract, then remove reasoning transcripts, repetition, and decorative AI slop. A contract is an obligation, invariant, precondition, postcondition, or compatibility promise that a caller, callee, implementer, producer, or consumer relies on.

## Prohibited AI-Slop Vocabulary (Mechanical Gate Failure)

The following self-congratulatory phrases and AI clichés are strictly forbidden across all repository files (`README.md`, `docs/**`, `packages/**`, `examples/**`) and fail `pnpm verify:docs`:
- `"industrial port"` / `"port industrial"`
- `"v2.0 Architecture"` / `"V2 Architecture"`
- `"advance the frontier"` / `"avançar a fronteira"`
- `"state-of-the-art"` / `"estado da arte"` (in self-descriptions of the repo)
- `"revolutionary"` / `"paradigm shift"` / `"seamlessly"` / `"battle-tested"`
- Narrated history (`"previously"`, `"used to"`, `"was moved"`, `"now implemented!"`)

## Core Rules

1. **One Home Per Fact**: Root `AGENTS.md` holds standing orders; `docs/architecture/` holds subsystem contracts; package `README.md` holds consumer configuration, semantics, and failure modes. Link instead of repeating.
2. **Concrete Actors and Facts**: Name the exact Cordis service (`ctx.dma`, `ctx.ffi`, `ctx.authority`, `ctx.federation`), C++20 symbol (`NativeContext::loadSharedLibrary`), offset (`0x2000`), or protocol (`node:tls` X.509 `requestCert: true`) instead of vague metaphors.
3. **Cross-Platform Commands Only in User Docs**: Never put Windows-only `.exe` paths (`build\native\lynxfita_explorer.exe`) as primary developer instructions in `README.md`. Use cross-platform workspace commands (`pnpm install`, `pnpm build`, `pnpm explore`, `pnpm test`, `pnpm bench`).
4. **Always Exclude `vendor/`**: Never modify or run prose edits inside `vendor/`.
