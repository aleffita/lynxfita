# LynxFita Vendor Patches Directory

This directory stores and versions atomic upstream patches applied to vendor submodules (`vendor/*`).

## Philosophy & Protocol

1. **Zero Uncontrolled Forks**: Instead of maintaining ad-hoc forks on GitHub that quickly diverge from upstream changes, LynxFita pins official upstream submodules and manages delta capabilities via cleanly tracked `.patch` files.
2. **Rebase & Backport Readiness**:
   - Whenever an upstream submodule is rebased or updated (`pnpm vendor:sync`), patches are re-validated (`pnpm vendor:patch --check`).
   - If a capability matures and aligns with upstream roadmaps, patches can be cleanly exported as upstream Pull Requests / backports.
3. **Directory Structure**:
   ```
   patches/
   ├── lynxtron/       # Patches applied to vendor/lynxtron
   ├── sparkling/      # Patches applied to vendor/sparkling
   ├── lynx/           # Patches applied to vendor/lynx
   ├── hermes/         # Patches applied to vendor/hermes
   └── primjs/         # Patches applied to vendor/primjs
   ```

## Workflow Commands

- `pnpm vendor:status`: Inspect all submodules, commit hashes, branches, and patch counts.
- `pnpm vendor:patch`: Apply all eligible patches to submodules.
- `pnpm vendor:verify`: Verify that all submodules exist and patch states are clean.
