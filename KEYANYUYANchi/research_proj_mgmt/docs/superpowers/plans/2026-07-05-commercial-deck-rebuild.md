# Commercial Research Project Deck Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `科研项目管理平台客户展示.html` from a text-heavy explanatory deck into a commercially persuasive visual proposal deck.

**Architecture:** Keep the existing single-file HTML stage and keyboard navigation, but replace the slide body, add reusable visual components, and rebuild the deck as a 19-page narrative with cover and agenda. Visual persuasion is delivered through SVG diagrams, mock product UI panels, evidence-chain flows, before/after comparisons, and concrete sample artifacts.

**Tech Stack:** Static HTML, CSS, inline SVG, existing local Playwright/Edge validation, `ppt-harness` prose checker.

---

## File Structure

- Modify: `D:\Downloads\research_proj_mgmt\科研项目管理平台客户展示.html`
  - Rebuild slide content and CSS components for a commercial visual deck.
  - Preserve local keyboard navigation and 1920×1080 scaling behavior.
- Modify: `D:\Downloads\research_proj_mgmt\docs\specs\customer-deck-narrative-spec.md`
  - Update page list and narrative constraints to the new 19-page commercial deck.
- Modify: `D:\Downloads\research_proj_mgmt\docs\specs\commercial-deck-quality-brief.md`
  - Mark this rebuild as the active design standard.
- Create/overwrite screenshots under: `D:\Downloads\research_proj_mgmt\.codex_work\deck_review\commercial_rebuild\`
  - Store verification screenshots for visual review.

## Task 1: Define the 19-page commercial narrative

- [x] Replace the current 24-page flow with this title flow:
  1. 科研项目管理平台建设方案
  2. 方案从管理断点走向可信动作
  3. 项目记录需要支撑正式管理动作
  4. 当前管理断点集中在项目、资金、合同和材料之间
  5. 需求框架已经覆盖关键管理对象
  6. 平台把管理要求沉淀为过程证据
  7. 事实和证据支撑正式动作
  8. 一本账先统一项目事实
  9. 证据链让每个判断能回到依据来源
  10. 节点报告从过程证据生成
  11. 采购申请从项目事实和规则生成
  12. 本体模型把对象关系变成可计算依据
  13. AI 工作台只在依据、权限和审核内行动
  14. 审核回放让 AI 输出可追溯
  15. 可信材料进入审批、财务合同和专业系统
  16. 结项材料在过程中持续齐套
  17. 一期交付聚焦可运行闭环和样机验证
  18. 建设路线从核心闭环扩展到跨系统可信动作
  19. 过程生成依据，人工审核决策

## Task 2: Rebuild CSS components

- [x] Add reusable visual components:
  - `.hero-map` for cover architecture visual.
  - `.breakpoint-map` for management断点图.
  - `.coverage-map` for需求覆盖图.
  - `.system-stack` for target architecture.
  - `.ledger-ui` and `.artifact-ui` for mock platform interface and sample documents.
  - `.ontology-canvas` for semantic object graph.
  - `.swimlane` for cross-system flow.
  - `.journey-roadmap` for phased path.
- [x] Keep the palette restrained: warm paper background, deep navy anchor, blue/cyan/gold accents only for semantic meaning.
- [x] Avoid decorative SVG. Every line and node must have label or semantic role.

## Task 3: Replace all slide sections

- [x] Replace current 24 `<section>` blocks with 19 sections.
- [x] Ensure every slide has one clear visual main object.
- [x] Ensure no page relies only on four text cards.
- [x] Keep visible copy short and customer-facing.

## Task 4: Update docs

- [x] Update `customer-deck-narrative-spec.md` to the 19-page structure.
- [x] Add note to `commercial-deck-quality-brief.md`: current active rebuild uses visual evidence pages, not card matrix pages.

## Task 5: Validate

- [x] Run `node D:\Downloads\ppt-harness\scripts\check-prose.js D:\Downloads\research_proj_mgmt\科研项目管理平台客户展示.html`.
- [x] Search forbidden words in the HTML.
- [x] Run Playwright with local Edge across all 19 slides; confirm no console errors and no overflow.
- [x] Screenshot key pages under `.codex_work/deck_review/commercial_rebuild`.
- [x] Inspect screenshots manually and adjust obvious layout problems.
