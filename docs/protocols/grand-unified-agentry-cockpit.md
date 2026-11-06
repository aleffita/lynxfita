---
type: protocol
title: Grand Unified Agentry Cockpit & Multi-Repo Federation Protocol
description: Architecture specification uniting the Cordis runtime spine, Ed25519 module federation, ByteDance A2UI GenUI, and host-native Git state orchestration.
tags:
  - cockpit
  - agentry
  - a2ui
  - genui
  - federation
  - cordis
  - multi-repo
  - stigmergy
timestamp: 2026-11-06
status: active
author: aleffita
---

# Grand Unified Agentry Cockpit & Multi-Repo Federation Protocol

This specification establishes the unified operational model uniting the **LynxFita Framework Monorepo**, the **Super-App Developer Cockpit**, the **Remote Module Federation Reconciler**, **ByteDance/Lynx A2UI GenUI**, and the **Git State Machine Orchestrator**.

```mermaid
flowchart TD
    classDef spine fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4
    classDef dx fill:#1e1e2e,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4
    classDef fed fill:#1e1e2e,stroke:#fab387,stroke-width:2px,color:#cdd6f4
    classDef nexus fill:#1e1e2e,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4
    classDef genui fill:#1e1e2e,stroke:#f9e2af,stroke-width:2px,color:#cdd6f4

    subgraph Framework["1. Framework Monorepo (lynxfita)"]
        CordisSpine["Cordis Microkernel Spine\n(LynxFitaContext / NativeContext)"]:::spine
        DMA["Stationary DMA & SIMD\n(Offsets 0x0000 - 0x3FFF)"]:::spine
        Builder["HBC Bytecode Packager\n(@lynxfita/builder)"]:::spine
    end

    subgraph Cockpit["2. Developer & Agent Cockpit (examples/explorer)"]
        CockpitShell["Super-App Cockpit Host\n(lynxfita://miniapp/developer-cockpit)"]:::dx
        Canvas["A2UI Dynamic Agent Canvas\n(@lynxfita/genui)"]:::genui
        Studio["Hermes Compiler Studio"]:::dx
    end

    subgraph Federation["3. Consumer Applications & Remote OTA"]
        Visualizer["Consumer App Mini-App\n(lynxfita-visualizer-3d)"]:::fed
        Updater["Ed25519 OTA Reconciler\n(@lynxfita/updater)"]:::fed
    end

    subgraph Nexus["4. Epistemological Nexus (insights)"]
        StateDag["Git DAG & Hashgraph Virtual Voting"]:::nexus
        Fastlane["Dockerless Lane Runner\n(Host Execution Sub-3ms)"]:::nexus
        FairDice["Provably Fair HMAC-SHA256 & 3d6"]:::nexus
    end

    CordisSpine -->|Mounts Revertible Effects| CockpitShell
    DMA -->|Telemetry Slot In-Place Math| Canvas
    Builder -->|Produces Signed Manifests| Updater
    Updater -->|Reconciles Bundles into Fibers| CockpitShell
    Visualizer -->|Fetches Remote Bundles Over Wire| Updater
    Fastlane -->|Probes Physical Repositories| StateDag
    StateDag -->|Consensus Rounds & Dice Rolls| Canvas
    Canvas -->|Dispatches A2UI Actions Back| Fastlane
```

---

## 1. Architectural Problems and the Unification Principle

Prior to this specification, development across autonomous agents and human systems engineers suffered from fragmented operational surfaces:
- **CLI Isolation**: Tools ran strictly as terminal scripts, preventing live visual introspection of runtime fibers, memory slots, and consensus rounds.
- **Local vs. Remote Bundle Disconnect**: Bundles were either hardcoded in monorepo directories or theoretical remote endpoints, lacking an integrated environment demonstrating both local baseline execution and cryptographically verified remote downloads.
- **Unconstrained Generative UI Hazards**: LLM-generated UIs typically attempted to synthesize arbitrary React or JavaScript strings, leading to parser errors, security sandbox violations, and unmaintainable interfaces.

The **Grand Unified Cockpit** resolves these fractures by anchoring all operations to an endogenous **Cordis Microkernel Spine** and an authorized **A2UI v0.9 Catalog**.

---

## 2. Upstream ByteDance Concepts & Architectural Synthesis

An exhaustive audit of the vendorized documentation (`vendor/lynx-website`) surfaces three foundational upstream concepts that anchor our multi-repo and agentic cockpit architecture:

### A. External Bundle & Cross-Application Reuse
In `vendor/lynx-website/docs/en/guide/build/external-bundle.mdx`:
- **Problem**: Monolithic desktop applications duplicate core dependencies and require monolithic redeployments for independent mini-apps.
- **ByteDance Solution**: The **External Bundle** architecture compiles standalone `.lynx.bundle` modules using `@lynx-js/lynx-bundle-rslib-config` and loads them at runtime across multiple Lynx apps via `@lynx-js/external-bundle-rsbuild-plugin` and `lynx.fetchBundle` (`FetchBundle` code-splitting).
- **LynxFita Adaptation**: `@lynxfita/builder` produces relocatable HBC bytecode bundles, and `@lynxfita/updater` acts as the cryptographic transport and reconciler, providing zero-downtime hot-swapping inside isolated Cordis Fibers.

### B. Lynx DevTool MCP Server (Agent & Human Unified DX)
In `vendor/lynx-website/docs/en/ai/lynx-devtool-mcp.mdx`:
- **Problem**: Developer tooling is historically designed exclusively for humans (GUIs) or exclusively for CLI scripts, forcing artificial divergence between human workflows and autonomous coding agents.
- **ByteDance Solution**: The `@lynx-js/devtool-mcp-server` exposes Chrome DevTools Protocol (CDP) over Model Context Protocol (MCP), enabling AI coding agents to inspect the DOM/CSS hierarchy, execute console evaluation, capture screenshots, and emulate UI interaction alongside human engineers.
- **LynxFita Adaptation**: The Developer Cockpit (`lynxfita://miniapp/developer-cockpit`) hosts REST/CDP automation endpoints (`/api/cockpit/*`), providing a unified interface equally operable by human engineers via browser UI and by autonomous agents via structured JSON commands.

### C. Generative UI: A2UI v0.9 & OpenUI Lang
In `vendor/lynx-website/docs/en/react/genui/a2ui.mdx` and `openui.mdx`:
- **Dual Formats**: A2UI provides flat, catalog-constrained JSON messages for structured card composition, while OpenUI provides compact, line-oriented streaming notation (`root = Stack([title, metric])`) for real-time generative feeds.
- **LynxFita Adaptation**: [`@lynxfita/genui`](file:///j:/limiar/packages/lynxfita/packages/genui) implements the A2UI v0.9 specification against [`LynxFitaCockpitCatalog`](file:///j:/limiar/packages/lynxfita/packages/genui/src/catalog.ts), ensuring AI agents compose dynamic cockpits without generating unconstrained or dangerous executable scripts.

```mermaid
sequenceDiagram
    autonumber
    participant Agent as Autonomous Agent / State Machine
    participant GenUI as @lynxfita/genui (A2UiSurfaceRenderer)
    participant Catalog as A2UI Authorized Catalog
    participant Lynx as Native Lynx Surface / Cockpit DOM

    Agent->>GenUI: Enqueue createSurface (surfaceId: cockpit-main)
    Agent->>GenUI: Enqueue updateDataModel (runtime metrics, DMA slots)
    Agent->>GenUI: Enqueue updateComponents (flat kebab-case ID tree)
    GenUI->>Catalog: Validate component types & required properties
    Catalog-->>GenUI: Validation Passed
    GenUI->>Lynx: Resolve reactive bindings & render declarative tree
    Note over Lynx: User interacts with button or control
    Lynx->>GenUI: Dispatch dispatchAction (componentId, onPress)
    GenUI->>Agent: Emit A2UI_USER_ACTION payload for next cycle
```

### Key Protocol Invariants:
1. **Zero Arbitrary Execution**: Agents NEVER emit executable JavaScript or HTML snippets. All generated cards must validate against [`LynxFitaCockpitCatalog`](file:///j:/limiar/packages/lynxfita/packages/genui/src/catalog.ts) (`Container`, `Card`, `Metric`, `Button`, `StatusBadge`, `MemorySlotView`, `DagNode`, `CodeBlock`).
2. **Flat Component Graph**: Components reference children by string ID rather than deep nesting, enabling minimal AST diffs during incremental updates.
3. **Reactive Data Model Bindings**: Properties using `"$bind:propName": "model.path"` dynamically re-render when `updateDataModel` messages arrive, avoiding full DOM reconstruction.

---

## 3. Remote Module Federation & OTA Reconciler Protocol

The Super-App Explorer incorporates [`@lynxfita/updater`](file:///j:/limiar/packages/lynxfita/packages/updater) to establish dual-mode bundle execution:

| Bundle Type | Storage & Distribution | Security Verification | Fault Tolerance Mechanism |
| :--- | :--- | :--- | :--- |
| **Embedded Baseline** (`1.0.0-embedded`) | Compiled directly into the host binary distribution. | Hermetically packaged with verified build hash. | Default immutable fallback for safe operation. |
| **Remote Federated** (`2.3.0-remote`) | Fetched dynamically from remote CDN or release artifact. | Ed25519 digital signature and SHA-256 payload checksum. | If verification fails, reconciler unloads the Fiber and falls back to baseline. |

### Deterministic Rollback Contract:
```typescript
const result = await federationService.reconcile(remoteBundle, signatureHex, trustedPublicKeyPem);
if (!result.signatureValid) {
  // 1. Log cryptographic verification failure
  // 2. Unload compromised or corrupted child Fiber
  // 3. Mount embedded baseline in clean isolated Context
}
```

---

## 4. Multi-Repo Co-Evolution Matrix

The three repositories interact as an interdependent ecosystem:

```
┌─────────────────────────────────┐
│ 1. Framework: lynxfita          │
│    - Core JSI & Cordis runtime  │
│    - Developer Cockpit Shell    │
└────────────────┬────────────────┘
                 │ Releases SDKs & HBC Packager
                 ▼
┌─────────────────────────────────┐       Consensus Rounds       ┌─────────────────────────────────┐
│ 2. Consumer: visualizer-3d      │◄─────────────────────────────┤ 3. Nexus: insights              │
│    - Standalone 3D Mini-App     │   Provably Fair Die Rolls    │    - Git DAG Virtual Voting     │
│    - WebGPU WGSL compute        │   Automated Lane Pipelines   │    - Fastlane Host Runner       │
└─────────────────────────────────┘                              └─────────────────────────────────┘
```

1. **Framework Monorepo (`lynxfita`)**: Maintains core host engines, memory layouts, and toolset packages (`@lynxfita/core`, `@lynxfita/genui`, `@lynxfita/builder`, `@lynxfita/updater`).
2. **Consumer Application (`lynxfita-visualizer-3d`)**: Exercises the SDK in a real-world scenario (3D compute shaders, particle advection), dogfooding remote federation and submitting friction PRs.
3. **Epistemological Nexus (`insights`)**: Orchestrates multi-agent state progression via Git DAG virtual voting, provably fair rolls, and sub-3ms host pipeline lanes.

---

## 5. Developer & Agent Cockpit Interface Guide

The Developer Cockpit is accessible in the Super-App Explorer via:
```bash
pnpm explore
# Navigate to: lynxfita://miniapp/developer-cockpit
```

### Supported Cockpit Panes:
- **Workspace Overview**: Inspects status of `lynxfita`, `visualizer-3d`, and `insights`.
- **Remote Federation & OTA**: Live testbed for downloading remote manifests and triggering deterministic signature rollbacks.
- **A2UI Agent Canvas**: Live surface consuming A2UI v0.9 JSON messages, rendering real-time metrics and routing action events.
- **Hermes AOT Compiler**: Interactive bytecode studio executing [`BundlePackager.packageHermesBundle`](file:///j:/limiar/packages/lynxfita/packages/builder/src/bundle_packager.ts).
- **State Machine & DAG**: Inspects consensus rounds, DAG reachability, and 3d6 roll distributions.
