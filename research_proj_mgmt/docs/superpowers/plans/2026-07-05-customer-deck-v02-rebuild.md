# Customer Deck v0.2 Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the customer-facing HTML deck around the approved 20-page story outline, with demand translation first and ontology/AI as a grounded extension.

**Architecture:** Keep the single-file static HTML deck and existing keyboard navigation. Replace the slide sequence, strengthen visual grids, add product-style mock platform pages, add data-flow and ontology-evolution diagrams, and update project specs with the new requirements and research evidence.

**Tech Stack:** Static HTML, CSS Grid, inline SVG, local `.docx` extraction via `python-docx`, browser verification with Playwright/Edge, `ppt-harness` prose checking.

---

## File Structure

- Modify: `D:\Downloads\research_proj_mgmt\科研项目管理平台客户展示.html`
  - Rebuild slides into the approved 20-page narrative.
  - Add reusable visual components for blueprint maps, lifecycle flows, status rules, data-flow diagrams, ontology evolution, and product mockups.
- Modify: `D:\Downloads\research_proj_mgmt\docs\specs\customer-deck-narrative-spec.md`
  - Update the active story outline and page responsibilities.
- Modify: `D:\Downloads\research_proj_mgmt\docs\specs\commercial-deck-quality-brief.md`
  - Add visual and alignment requirements from the latest critique.
- Create: `D:\Downloads\research_proj_mgmt\docs\specs\customer-deck-v02-research-brief.md`
  - Record external research sources and the deck implications.
- Create or update screenshots under: `D:\Downloads\research_proj_mgmt\.codex_work\deck_review\v02_rebuild\`
  - Store rendered slides, report, and contact sheets.

## Tasks

- [ ] **Task 1: External research pass**
  - Search official sources for research management platforms, sponsored project lifecycle tools, project controls, closeout requirements, ontology/action/audit practices, and enterprise integration patterns.
  - Save findings to `docs/specs/customer-deck-v02-research-brief.md`.

- [ ] **Task 2: Requirement blueprint pass**
  - Re-read `科研项目信息化管理平台需求V18_脱敏版.docx`.
  - Extract the platform blueprint: management objects, lifecycle phases, roles, states, forms, approvals, data sources, system touchpoints.
  - Update narrative specs to ensure every major requirement has a page-level destination.

- [ ] **Task 3: HTML deck rebuild**
  - Replace the existing 19 slides with 20 slides matching the approved outline.
  - Use stable dimensions and explicit grid alignment for all repeated elements.
  - Avoid generic card dumps; each page needs one clear visual subject.

- [ ] **Task 4: Visual and copy self-review**
  - Check each page from the customer's perspective: what is being built, what demand it maps to, what platform capability it proves.
  - Remove AI-ish language and relation-based wording.
  - Keep Palantir/external methods out of the story body unless used as source notes.

- [ ] **Task 5: Verification**
  - Run `node D:\Downloads\ppt-harness\scripts\check-prose.js`.
  - Search forbidden customer-facing terms in the HTML.
  - Render all slides with Playwright/Edge.
  - Check console errors, overflow, clipped text, and obvious alignment drift.
  - Generate a contact sheet for manual visual review.

