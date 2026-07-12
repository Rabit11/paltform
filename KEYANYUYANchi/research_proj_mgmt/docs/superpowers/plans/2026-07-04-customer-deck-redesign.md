# Customer Deck Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing customer presentation HTML into a 12-slide browser deck for a client-facing research project management platform proposal.

**Architecture:** Keep the deliverable as a single self-contained HTML file so it can be opened directly from the current workspace. Use fixed 1920x1080 slides, keyboard navigation, responsive scaling, print-friendly slide pages, and a sober enterprise visual system.

**Tech Stack:** Static HTML, CSS, and vanilla JavaScript.

---

### Task 1: Preserve Existing Version

**Files:**
- Create: `D:\Downloads\research_proj_mgmt\科研项目管理平台客户展示_客户Deck改版前备份.html`
- Modify: `D:\Downloads\research_proj_mgmt\科研项目管理平台客户展示.html`

- [x] **Step 1: Create a backup**

Run:

```powershell
Copy-Item -LiteralPath 'D:\Downloads\research_proj_mgmt\科研项目管理平台客户展示.html' -Destination 'D:\Downloads\research_proj_mgmt\科研项目管理平台客户展示_客户Deck改版前备份.html' -Force
```

- [x] **Step 2: Confirm backup exists**

Run:

```powershell
Get-Item -LiteralPath 'D:\Downloads\research_proj_mgmt\科研项目管理平台客户展示_客户Deck改版前备份.html'
```

Expected: the backup file exists and has non-zero length.

### Task 2: Rewrite The HTML As A Deck

**Files:**
- Modify: `D:\Downloads\research_proj_mgmt\科研项目管理平台客户展示.html`

- [x] **Step 1: Replace long webpage structure with a 12-slide deck**

Create slides for:

```text
01 封面
02 为什么现在要做
03 当前科研管理痛点
04 普通平台形态
05 普通平台为什么不够
06 贵方需求的成熟度
07 先交付什么
08 Palantir 式本体论实践
09 科研项目本体设计
10 AI 能力与人类审核
11 跨系统可信闭环
12 合作目标
```

- [x] **Step 2: Add deck navigation**

Implement keyboard navigation for ArrowLeft, ArrowRight, Space, Home, End, hash jump, counter, and scaling to the viewport.

- [x] **Step 3: Remove internal phrasing**

Search for and eliminate:

```text
本版
这份需求
本轮
一期不建议
开发方案梳理版
```

### Task 3: Verify The Deck

**Files:**
- Test: `D:\Downloads\research_proj_mgmt\科研项目管理平台客户展示.html`

- [x] **Step 1: Static search**

Run:

```powershell
rg -n "本版|这份需求|本轮|一期不建议|开发方案梳理版|Planview|ServiceNow" "D:\Downloads\research_proj_mgmt\科研项目管理平台客户展示.html"
```

Expected: no matches.

- [x] **Step 2: Browser verification**

Use Playwright to open the file, count 12 slides, navigate to each slide, check no page errors, and capture desktop screenshots.

Expected: 12 slides, no console errors, no page errors, no horizontal overflow, all slides reachable by keyboard.
