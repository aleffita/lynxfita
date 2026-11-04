---
name: vendor-submodule-patch
description: Patterns and procedures for checking, applying, and reverting atomic git patches across vendored upstream submodules in LynxFita.
---

# Vendor Submodule Patch Skill

## When to Use
Use when:
- Inspecting the state of git submodules in `vendor/`.
- Verifying whether patches apply cleanly (`--check` / `--dry-run`).
- Applying atomic patches to submodules (`--apply`).
- Reverting applied patches to restore a clean submodule working tree (`--revert`).

## Command Protocols
- **Status Inventory**:
  ```powershell
  pnpm vendor:status
  ```
- **Dry-Run Check**:
  ```powershell
  node scripts/vendor-patch.mjs --check
  ```
- **Apply Patches**:
  ```powershell
  pnpm vendor:patch
  ```
- **Revert Patches**:
  ```powershell
  pnpm vendor:revert
  ```

## Invariants
1. Patches live in `patches/<target-submodule>/`.
2. Format is standard git patch output (`git format-patch` or unified diff).
3. Always revert patches before running root `git commit` unless committing updated submodule pointers.
