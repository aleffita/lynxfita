---
type: protocol
title: Vendor Submodules Domain Agentry Indexer
description: Governance, synchronization protocols, and zero-fork patch management for upstream vendor submodules.
tags:
  - agentry
  - vendor
  - submodules
  - patches
  - indexer
timestamp: 2026-11-04
status: active
author: aleffita
---

# Vendor Submodules Domain Agentry Indexer

## 1. Domain Governance
This domain establishes the zero-fork upstream vendoring strategy: official ByteDance, TikTok, and Meta repositories are pinned as Git submodules in `vendor/`, and custom extensions are tracked as atomic `.patch` files in `patches/`.

### Vendored Submodule Inventory
1. [`vendor/lynx`](file:///j:/limiar/packages/lynxfita/vendor/lynx) (`main` @ `50596e6`): Core Lynx cross-platform engine.
2. [`vendor/lynxtron`](file:///j:/limiar/packages/lynxfita/vendor/lynxtron) (`main` @ `f0560b2`): Desktop framework shell.
3. [`vendor/hermes`](file:///j:/limiar/packages/lynxfita/vendor/hermes) (`static_h` @ `4027773`): Meta Static Hermes runtime & AOT compiler.
4. [`vendor/primjs`](file:///j:/limiar/packages/lynxfita/vendor/primjs) (`main` @ `1617842`): ByteDance JS / Lepus runtime engine.
5. [`vendor/sparkling`](file:///j:/limiar/packages/lynxfita/vendor/sparkling) (`main` @ `0939eb4`): TikTok / ByteDance native application platform SDK.
6. [`vendor/lynx-stack`](file:///j:/limiar/packages/lynxfita/vendor/lynx-stack) (`main` @ `b3150c1`): RSpeedy bundler, CLI & GenUI tooling.
7. [`vendor/lynx-website`](file:///j:/limiar/packages/lynxfita/vendor/lynx-website) (`main` @ `234d63b`): Official documentation & guides.

### Patch Management & Workflow
- **Inventory & Verification**: `pnpm vendor:status` / `pnpm vendor:verify`.
- **Applying Patches**: `pnpm vendor:patch` (runs `scripts/vendor-patch.mjs --apply`).
- **Reverting Patches**: `pnpm vendor:revert` (runs `scripts/vendor-patch.mjs --revert`).
- **Upstream Sync**: `pnpm vendor:sync` (runs `git submodule update --init --recursive`).

## 2. Invariants for Vendor Operations
1. **Zero Forks**: Never maintain fork repositories on GitHub; all custom modifications must live in `patches/<submodule>/XXXX-name.patch`.
2. **Rebase Discipline**: When upstream submodules advance, verify that patches still apply cleanly (`node scripts/vendor-patch.mjs --check`).
3. **Commit Cleanliness**: Always ensure submodule working trees are clean before committing changes to the monorepo root.
