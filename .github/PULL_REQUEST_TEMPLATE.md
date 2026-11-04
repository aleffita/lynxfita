## Summary of Changes
<!-- Provide a clear BLUF (Bottom Line Up Front) summary of what this PR introduces and why. -->

## Affected Areas
- [ ] Native C++ Engine (`src/native/`)
- [ ] TypeScript Packages (`packages/core`, `packages/codegen`, `packages/wasi-runtime`, `packages/builder`, `packages/updater`, `packages/cli`)
- [ ] Vendor Submodules (`vendor/`)
- [ ] CI/CD Workflows (`.github/workflows/`)
- [ ] Research & Epistemic Docs (`docs/`)

## Verification Record
- **Deep Verification (Ran Real Tests):**
  - [ ] `pnpm test` (all workspace package tests passed)
  - [ ] Native C++ test runner passed (`ctest` / `scripts\test-native.cmd`)
  - [ ] Submodule verification passed (`node scripts/vendor-sync.mjs --verify`)
- **Shallow Verification (Manual Inspection):**
  - [ ] Eyeballed outputs and formatting
- **Unverified Aspects:**
  - [ ] List any platform-specific edge cases not covered

## Known Issues & Caveats
- [ ] None (or list explicitly with severity prefix)

## Checklist
- [ ] Follows Gitflow branching model (`feature/*` -> `develop` or `release/*` -> `main`)
- [ ] No weakened or deleted test assertions
- [ ] Zero reward hacking / lookup tables
- [ ] OKF frontmatter present on any new research documents
