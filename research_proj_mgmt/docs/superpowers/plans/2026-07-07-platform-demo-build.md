# 科研项目信息化管理平台 演示版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, single executor — user waived checkpoints). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the platform from scratch as an interactive demo: dark mission-control frontend (React) with role-based pages, backed by Express + SQLite with rich seeded data.

**Architecture:** Two workspaces under `platform/`: `server/` (Express + better-sqlite3, dynamic four-color status computed from due dates, REST API, audit-logged mutations) and `web/` (Vite + React 18 + TS + Tailwind v4 + ECharts custom dark theme + hand-made SVG icon/art system). Dev via vite proxy; demo via server statically hosting `web/dist`.

**Tech Stack:** Node 22, Express 4, better-sqlite3 (JSON-store fallback), Vite 6, React 18, TypeScript, Tailwind CSS v4, ECharts 5, react-router, lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-07-platform-demo-design.md`

---

### Task 1: Scaffold workspaces

**Files:** Create `platform/package.json`, `platform/server/package.json`, `platform/web/*` (via `npm create vite@latest web -- --template react-ts`), `platform/web/vite.config.ts` (proxy `/api`→`http://localhost:8787`, tailwind v4 plugin).

- [ ] `npm create vite` web app; add deps: `echarts react-router-dom lucide-react`, dev: `tailwindcss @tailwindcss/vite`
- [ ] server deps: `express cors better-sqlite3`; `"type":"module"`
- [ ] Root scripts: `dev` (concurrently server+web), `seed`, `demo` (seed+build+start)
- [ ] Verify: `node server/src/index.js` boots; `npm run dev -w web` serves; commit `feat(platform): scaffold`

### Task 2: Backend — schema + domain + seed

**Files:** Create `platform/server/src/db.js`, `domain.js`, `seed.js`, `data/` (gitignored db file).

Schema (tables): `units(id,name,short,type)`, `channels(id,name,level,dept,flow_json,declare_materials_json,filing_materials_json)`, `users(id,name,role,unit_id,title)`, `projects(id,code,name,goal,level,channel_id,lead_unit_id,partners_json,team_json,start,end,status,total_budget,phase,tags_json)`, `milestones(id,project_id,year,seq,title,due,done_at,evidence,note)`, `plans(id,project_id,title,source,due,done_at,status)`, `funds(id,project_id,year,budget,spent,writeoff_json)`, `funding_pool(year,total,allocated_json)`, `funding_requests(id,unit_id,year,amount,purpose,status,history_json)`, `deliverables(id,project_id,name,type,due,delivered_at,owner,package_id)`, `packages(id,code,name,project_id,mode,form,plan_date,actual_date,status,brief,unit_id)`, `collaborators(id,project_id,name,ctype,scores_json,total,grade,eval_date,blacklisted)`, `post_evals(id,project_id,status,started_at,due,conclusion,scores_json)`, `approvals(id,type,title,project_id,initiator,unit_id,created_at,status,current_step,steps_json,payload_json)`, `changes(id,project_id,kind,fields_json,reason,status,created_at)`, `alerts(id,project_id,kind,level,title,due,created_at,read)`, `audit(id,ts,user_id,action,target,detail)`.

Domain rules (`domain.js`): `statusColor(due, doneAt, today)` → green if done; red if overdue; yellow if ≤30d; blue else. `projectColor` = worst of open milestone colors (红>黄>蓝>绿). Grade: `score>=90 优秀, >=80 良好, >=60 合格, else 不合格→blacklist`.

- [ ] Write `domain.js` + node:test `platform/server/test/domain.test.js` covering all four colors + priority; run `node --test`
- [ ] Write schema + seed (~40 projects, 13 channels, 6 units, milestones spanning all colors relative to today, funds, deliverables, packages, collaborators incl. one <60, post_evals for >1亿 finished project, ~12 pending approvals of 5 types, alerts, audit)
- [ ] Verify: `node src/seed.js` prints table counts; sanity: every channel has ≥1 project, all four colors present; commit

### Task 3: Backend — REST API

**Files:** Create `platform/server/src/api.js`, `index.js`.

Routes: `GET /api/bootstrap` (units, channels, users, today); `GET /api/projects` (filters: level, channel, unit, status, color, kw; role scoping via `x-user` header); `GET /api/projects/:id` (aggregate: milestones, plans, funds, deliverables, packages, collaborators, approvals, changes, docs timeline, post_eval); `GET /api/dashboard` (KPIs + 6 chart datasets + risk list, filter: year/unit/level); `GET /api/alerts`; `GET/POST /api/approvals`, `POST /api/approvals/:id/act {action:approve|reject, comment}` (advances steps_json, writes audit, on final approval applies side effects: declaration→project status 立项中→实施中 etc.); `POST /api/declarations` (creates draft project + approval); `POST /api/milestones/:id/complete {evidence}`; `POST /api/plans/:id/finish`; `POST /api/changes`; `GET /api/finance/:unitId` (funds rollup), `GET /api/funding` (pool + requests), `POST /api/funding/requests`, `POST /api/funding/requests/:id/act`; `GET /api/evaluations` (collaborators + blacklist + post_evals); `GET /api/admin` (dict + users + flows + audit); CSV export `GET /api/projects.csv`.

- [ ] Implement + boot server; smoke: `curl :8787/api/dashboard | jq .kpis`, approvals act cycle mutates DB & audit
- [ ] Commit

### Task 4: Web — design system, icons, art, shell

**Files:** Create `web/src/theme.css` (Tailwind v4 `@theme` tokens: bg/surface/line/ink/accent/four-color; scrollbar, focus ring, tabular-nums utility), `lib/format.ts` (万元, dates, countUp), `lib/status.ts` (color maps), `api/client.ts`, `store/session.tsx` (persona context + role routes), `components/ui/*` (Card, KPI, Badge, StatusDot, Btn, Table, Tabs, Modal, Field, Empty, Toast, FilterBar), `components/charts/EChart.tsx` (+dark theme registration), `components/icons/index.tsx` (~20 custom 24px 1.5-stroke SVG domain icons), `components/art/*` (Logo, AircraftBlueprint, RadarSweep, GridBg, LifecycleDiagram), `components/layout/{Shell,Sidebar,Topbar}.tsx`, `pages/Login.tsx`, `App.tsx` (router + role guard).

- [ ] Tokens + EChart dark theme (one accent #38BDF8, four status colors, hairline grid)
- [ ] Icons + art components (pure SVG, no external assets)
- [ ] Login persona page (aircraft blueprint hero, 5 role cards), shell with role-scoped nav, alerts bell
- [ ] Verify in browser via Playwright screenshot; commit

### Task 5: Web — HQ pages

**Files:** `pages/cockpit/Cockpit.tsx`, `pages/projects/Ledger.tsx`, `pages/projects/Detail.tsx` (+ tab sections in `pages/projects/tabs/*.tsx`), `pages/approvals/Approvals.tsx`, `pages/alerts/Alerts.tsx`, `pages/evaluation/Evaluations.tsx`.

- [ ] Cockpit: KPI band (count-up), 层级/渠道分布, 经费预算vs执行, 里程碑四色矩阵, 风险预警榜, 交付物产出, 成果转化, filter bar, click→ledger drill; radar art
- [ ] Ledger: filter bar, dense table (mono numerals, four-color dot, 层级/渠道 chips), column toggle, CSV export, row→detail
- [ ] Detail: header + lifecycle SVG + tabs (概览/里程碑时间线/经费/交付物/协作评价/成果转化/审批与文档)
- [ ] Approvals: queue + detail drawer + approve/reject (persists, toast, step advance)
- [ ] Alerts + Evaluations (五维评分条, 黑名单, 后评价)
- [ ] Playwright screenshot pass; commit

### Task 6: Web — team / chief / finance / admin pages

**Files:** `pages/team/{Workbench,Declare,Milestones,Plans,Changes}.tsx`, `pages/review/Review.tsx`, `pages/finance/{Finance,Funding}.tsx`, `pages/admin/Admin.tsx`.

- [ ] Workbench (my projects, todos, alerts), Declare wizard (channel→materials→submit→approval created), Milestones (complete w/ evidence → color flips), Plans (CMOS badge, finish flow), Changes (two entries)
- [ ] Review: queue, material summary, 通过/退回 with opinion
- [ ] Finance: unit funds table + charts + 核销记录; Funding: pool gauge, per-unit quota bars, request act
- [ ] Admin: channel dict CRUD-ish (read+edit dialog), 权限矩阵表, 流程模板可视化(步骤条), audit log table
- [ ] Playwright pass; commit

### Task 7: E2E verify + polish

- [ ] Seed→demo build→walk all 5 roles' pages via Playwright; screenshot each; fix visual defects (spacing, overflow, contrast, chart sizing)
- [ ] Verify mutations end-to-end (approve→project status change; milestone complete→cockpit red count drops)
- [ ] a11y: focus states, aria-labels on icon buttons, reduced-motion
- [ ] Commit

### Task 8: Docs + handoff

- [ ] `platform/README.md`（启动、账号、演示动线脚本）; root README pointer
- [ ] Final commit + report

## Self-Review
- Spec coverage: 六大业务域/5角色/四色/预警/黑名单/后评价/双轨经费/差异化申报材料 → Tasks 2–6 全覆盖 ✓
- No placeholders; types fixed in Task 2 schema; API names locked in Task 3 and reused in 4–6 ✓
