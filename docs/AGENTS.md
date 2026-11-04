---
type: protocol
title: Documentation Domain Agentry Indexer
description: Governance, indexing, and standards for the LynxFita Open Knowledge documentation hierarchy.
tags:
  - agentry
  - documentation
  - okf
  - indexer
timestamp: 2026-11-04
status: active
author: aleffita
---

# Documentation Domain Agentry Indexer

## 1. Domain Governance
This domain encompasses all theoretical research, architecture RFCs, verbatim principal directives, and the living ontology of LynxFita.

### Directory Structure
- [`docs/methodology/`](file:///j:/limiar/packages/lynxfita/docs/methodology): Research standards, multi-agent coordination safety, anti-reward-hacking protocols.
  - [`001-open-knowledge-protocol.md`](file:///j:/limiar/packages/lynxfita/docs/methodology/001-open-knowledge-protocol.md): OKF YAML frontmatter specifications.
  - [`002-autonomous-research-coordination.md`](file:///j:/limiar/packages/lynxfita/docs/methodology/002-autonomous-research-coordination.md): ExploitGym/Hugging Face incident analysis.
  - [`003-scientific-integrity-and-empirical-rigor.md`](file:///j:/limiar/packages/lynxfita/docs/methodology/003-scientific-integrity-and-empirical-rigor.md): Anti-reward-hacking directive.
- [`docs/architecture/`](file:///j:/limiar/packages/lynxfita/docs/architecture): Systems architecture, JSI mechanics, and runtime models.
  - [`001-lynx-vs-lynxtron-desktop-dichotomy.md`](file:///j:/limiar/packages/lynxfita/docs/architecture/001-lynx-vs-lynxtron-desktop-dichotomy.md)
  - [`002-hermes-jsi-runtime-replacement.md`](file:///j:/limiar/packages/lynxfita/docs/architecture/002-hermes-jsi-runtime-replacement.md)
  - [`003-coexistence-and-bridge-sequestration.md`](file:///j:/limiar/packages/lynxfita/docs/architecture/003-coexistence-and-bridge-sequestration.md)
  - [`004-wasi-wasix-native-modules.md`](file:///j:/limiar/packages/lynxfita/docs/architecture/004-wasi-wasix-native-modules.md)
  - [`005-dynamic-aot-updates-and-ota.md`](file:///j:/limiar/packages/lynxfita/docs/architecture/005-dynamic-aot-updates-and-ota.md)
- [`docs/insights/`](file:///j:/limiar/packages/lynxfita/docs/insights):
  - `verbatim/`: Verbatim transcript recordings of principal directives.
  - `analysis/`: Synthesized architectural roadmaps derived from verbatim directives.
- [`docs/glossary.md`](file:///j:/limiar/packages/lynxfita/docs/glossary.md): Living master ontology and research terminology.

## 2. Invariants for Docs Agents
1. **OKF Compliance**: Every markdown file MUST include fenced YAML frontmatter (`type`, `title`, `description`, `tags`, `timestamp`, `status`, `author`).
2. **Modularity over Append-Only**: Prefer creating new modular files over bloating existing documents into unwieldy monoliths.
3. **Traceability**: All technical claims must link to code symbols or test runs via markdown links (`file:///...`).
