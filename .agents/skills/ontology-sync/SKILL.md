---
name: ontology-sync
description: Protocols for ingesting principal feedback, maintaining taxonomic consistency, and updating the living research glossary.
---

# Ontology Sync Skill

## When to Use
Use when:
- Receiving feedback, architectural directives, or critique from the principal researcher.
- Introducing new runtime terminology, framework concepts, or benchmark metrics.
- Synchronizing tags and schemas across Open Knowledge Format (OKF) markdown documents.

## Operational Workflow
1. **Verbatim Capture**:
   - Transcribe principal directives verbatim into `docs/insights/verbatim/YYYY-MM-DD-<slug>.md`.
2. **Epistemic Synthesis**:
   - Synthesize architectural implications into `docs/insights/analysis/YYYY-MM-DD-<slug>.md`.
3. **Glossary Update**:
   - Add new concepts, boundaries, or runtime primitives to [`docs/glossary.md`](file:///j:/limiar/packages/lynxfita/docs/glossary.md).
4. **Behavioral Ingestion**:
   - If the feedback modifies an operational directive, immediately update the relevant domain `AGENTS.md` without debate or performative agreement.

## Directives
- **Zero Flattery**: Never apologize or debate. Directly reflect the change in the system ontology.
- **Rigor**: Define terms in the context of systems engineering (e.g. host memory boundaries, execution loops, JSI pointers).
