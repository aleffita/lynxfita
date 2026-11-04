---
type: protocol
title: Open Knowledge Protocol Specification
description: Implementation specification of Google's Open Knowledge Format (OKF) for the LynxFita research ecosystem.
tags:
  - methodology
  - okf
  - open-knowledge
  - yaml-frontmatter
  - documentation
timestamp: 2026-11-04
status: active
author: aleffita
---

# 001 — Open Knowledge Protocol Specification

## 1. Overview & Motivation
As automated AI agents collaborate with human principal researchers on high-depth systems engineering, unstructured documentation creates context fragmentation and semantic drift. LynxFita adopts Google's **Open Knowledge Format (OKF)** specification.

OKF represents knowledge as **plain Markdown files augmented with standardized YAML frontmatter**, combining machine-parseable indexability with human-readable clarity.

## 2. YAML Frontmatter Schema

Every document in `docs/` must start with a fenced YAML block containing:

| Field | Type | Required | Values / Examples | Description |
| :--- | :--- | :--- | :--- | :--- |
| `type` | string | Yes | `concept`, `metric`, `protocol`, `insight`, `architecture`, `runbook`, `hypothesis` | Epistemic category of the document |
| `title` | string | Yes | e.g. "Hermes JSI Direct Dispatch" | Human-readable title |
| `description` | string | Yes | e.g. "Analysis of JSI bridge sequestration" | One-sentence summary for search and retrieval |
| `tags` | list | Yes | `[runtime, hermes, jsi]` | Tag taxonomy for semantic clustering |
| `timestamp` | date | Yes | `YYYY-MM-DD` | Date of document creation or major revision |
| `status` | string | Yes | `draft`, `active`, `deprecated`, `verified` | Operational validity status |
| `author` | string | Optional | e.g. `aleffita` or subagent ID | Originator identity |

## 3. Structural Rules

1. **Modularity over Monoliths**: Create dedicated concept files rather than appending everything to giant monolithic files.
2. **Indexed Syntheses**: When a topic branches into multiple files, create a domain indexer file linking the children.
3. **Traceability**: Code snippets must point to source files using GitHub markdown links (`[path/to/file](file:///...)`).
