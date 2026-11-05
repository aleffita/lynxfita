---
name: archify
description: Create polished, validated architecture, workflow, sequence, data-flow, and lifecycle/state diagrams for LynxFita using the local Archify compiler (.agents/skills/archify/bin/archify.mjs) with showcase validation and automated Chrome DevTools visual-check.
---

# Archify Diagram Generation Skill (LynxFita)

Never hand-author raw unstyled Mermaid or synthetic AI-slop SVG banners. All architecture, workflow, sequence, dataflow, and lifecycle diagrams in `docs/architecture/` and `README.md` MUST be authored as typed Archify JSON specifications in `docs/architecture/specs/*.json` and compiled through the local Archify engine at `.agents/skills/archify/bin/archify.mjs`.

## Mandatory Workflow

1. **Select Diagram Type**: `architecture`, `workflow`, `sequence`, `dataflow`, or `lifecycle`.
2. **Inspect Schema**: Read the corresponding schema in `.agents/skills/archify/schemas/` and `common.schema.json`.
3. **Author JSON Spec**: Write `docs/architecture/specs/<name>.<type>.json` with `meta.quality_profile: "showcase"`, at most 12 primary nodes, one clear main path, and exact component/protocol names from the LynxFita codebase (`ctx.dma`, `ctx.ffi`, `ctx.wasi`, `ctx.gpu`, `ctx.authority`, `ctx.federation`).
4. **Validate**:
   ```bash
   node .agents/skills/archify/bin/archify.mjs validate <type> docs/architecture/specs/<name>.<type>.json --quality showcase --json
   ```
   Require 9/9 artifact checks, 0 errors, and 0 warnings.
5. **Atomic Deliver**:
   ```bash
   node .agents/skills/archify/bin/archify.mjs deliver <type> docs/architecture/specs/<name>.<type>.json docs/architecture/<name>.html --quality showcase --json
   ```
6. **Automated Browser Visual Check & Screenshot Sidecars**:
   ```bash
   node .agents/skills/archify/bin/archify.mjs visual-check docs/architecture/<name>.html --json
   ```
   This verifies 4 desktop viewports (`1440x900`, `1600x1000`, `1920x1080`, `2048x1320`) in headless Chrome and emits light/dark PNG sidecars (`<name>.visual-check-1440x900-dark.png`, `<name>.visual-check-1440x900-light.png`) suitable for embedding in Markdown documentation.
