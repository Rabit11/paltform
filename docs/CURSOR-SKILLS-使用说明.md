# Cursor Skills 使用说明

> 科研项目信息化管理平台 · Vue3 + Express + Prisma + PostgreSQL + Docker  
> 更新日期：2026-07-07  
> 配套文档：[收藏清单](./CURSOR-SKILLS-收藏清单.md)

---

## 一、Skill 是什么？

**Skill** 是给 Cursor Agent 看的专项操作手册，每个 Skill 对应一个 `SKILL.md` 文件，包含：

- **何时使用**（`description` 字段）
- **工作流程**（步骤、检查清单）
- **代码规范**（命名、结构、最佳实践）

Agent 在对话中会根据你的任务描述，自动读取相关 Skill，按其中的规范写代码、做设计或排错。

**Skill 不是需要手动运行的程序**，也不是 VS Code 插件。你不需要在终端执行它。

---

## 二、本项目已安装的 Skills

安装位置：`.cursor/skills/`（项目级，随仓库同步）

| 分类 | Skill 目录 | 来源仓库 | 主要用途 |
|------|-----------|----------|----------|
| 前端 | `ui-design-system` | aussiegingersnap/cursor-skills | 设计方向、精致 UI、风格指南 |
| 前端 | `using-ui-stack` | awesome-cursor-skills | 8px 网格、配色、字体、交互状态 |
| 前端 | `visual-qa-testing` | awesome-cursor-skills | 内置浏览器截图、控制台与网络检查 |
| 后端 | `api-rest` | aussiegingersnap/cursor-skills | REST 命名、HTTP 语义、错误格式 |
| 后端 | `feature-build` | aussiegingersnap/cursor-skills | 大功能全流程编排（需求→实现→验收） |
| 后端 | `infra-docker` | aussiegingersnap/cursor-skills | Docker Compose、本地/容器环境 |
| 数据库 | `db-postgres` | aussiegingersnap/cursor-skills | PostgreSQL 迁移、索引、排错 |
| 数据库 | `database-design` | awesome-cursor-skills | 表结构设计、实体关系、约束 |

上游完整仓库（本地克隆，不提交 Git）：

```
third-party/aussiegingersnap-cursor-skills/
third-party/awesome-cursor-skills/
```

---

## 三、Cursor 如何加载 Skills？

1. 用 **Cursor Agent 模式** 打开本项目
2. Cursor 自动扫描 `.cursor/skills/*/SKILL.md`
3. 根据文件头 `description` 判断是否与当前任务相关
4. 相关时 Agent 读取 Skill 内容并遵循其规范

### 查看已加载的 Skills

- `Ctrl + Shift + J` → **Rules** 标签 → 查看项目 Skills
- 或直接打开 `.cursor/skills/<名称>/SKILL.md` 阅读原文

### 两种触发方式

| 方式 | 做法 | 适用场景 |
|------|------|----------|
| **自动触发** | 直接描述任务，不提 Skill 名称 | 日常开发（推荐） |
| **手动点名** | 提示词中写「按 xxx skill」或「先读 `.cursor/skills/...`」 | 强制某套规范时 |

支持用户显式调用的 Skill（`user-invocable: true`）：

- `using-ui-stack`
- `database-design`

---

## 四、各 Skill 详解与示例提示词

### 4.1 `ui-design-system` — 设计哲学 + 精致 UI

**适合：** 页面整体改版、新模块视觉设计、提升专业感

**提供内容：**

- 设计方向选择（专业可信 / 高密度 / 温暖 / 大胆等）
- 4px 网格、对称内边距、圆角与层次规范
- Linear / Notion / Stripe 级 UI 细节要求

**本项目适配：** 示例模板为 Next.js/React，**设计思路可沿用**，组件语法跟 Vue + Element Plus 走。

**示例提示词：**

```
按 ui-design-system，重做 Board.vue 六大维度卡片：
信息密度要高、适合科研人员日常使用，风格偏「专业可信」。
```

```
按 ui-design-system 的「Sophistication & Trust」方向，
优化 Apply.vue 立项表单的信息层次和视觉密度。
```

---

### 4.2 `using-ui-stack` — 可执行的 UI 硬规范

**适合：** 写/改 Vue 组件时统一间距、颜色、字体

**提供内容：**

- 8px 网格间距（4 / 8 / 16 / 24 / 32 / 48）
- 60-30-10 配色法则
- 1.25 字号比例、暗色模式、hover/focus 状态

**与 `ui-design-system` 的区别：**

| Skill | 侧重 |
|-------|------|
| `ui-design-system` | 审美方向、产品气质 |
| `using-ui-stack` | 具体数值与组件规范 |

**示例提示词：**

```
用 using-ui-stack 规范优化 ComacPieChart.vue 及周围布局，
与 Board.vue 保持一致的间距和配色。
```

---

### 4.3 `visual-qa-testing` — UI 改完后的视觉验收

**适合：** 前端改完后自动打开页面、截图、查报错

**工作流程：**

1. 确认 dev server 已启动
2. 用 Cursor 内置浏览器打开目标页面
3. 全页截图检查布局、颜色、对齐
4. 检查 Console 错误与 Network 请求

**示例提示词：**

```
Board.vue 改完了，按 visual-qa-testing：
启动本地服务 → 打开看板页 → 全页截图 → 检查 /api/board 和控制台。
```

```
对 114 服务器 http://10.90.111.114:8084 的登录页和看板做 visual QA。
```

**前提：** Cursor 内置浏览器 MCP（`cursor-ide-browser`）可用。

---

### 4.4 `api-rest` — REST API 设计规范

**适合：** 新增/改造 Express 接口（`platform/backend/src/index.js` 等）

**提供内容：**

- 资源复数命名：`/api/projects` 而非 `/api/project`
- HTTP 方法语义：GET 查、POST 建、PATCH 部分改、DELETE 删
- 统一错误响应、输入校验（示例用 Zod，可映射到项目现有校验）

**本项目适配：** Skill 示例为 Next.js App Router，吸收 **命名与结构规范**，路由写法用 Express。

**示例提示词：**

```
按 api-rest 规范，新增项目结题 API：
GET/POST /api/projects/:id/closure，错误格式参考现有 /api/board。
```

```
按 api-rest 审查 backend/src/index.js 中 admin 相关路由命名是否一致。
```

---

### 4.5 `feature-build` — 完整功能开发编排

**适合：** 跨前后端、多步骤的大功能（不是改一行 CSS）

**五阶段：**

1. 拆任务、写验收标准
2. 设计组件 / API
3. 编码 + 浏览器验证
4. （可选）埋点
5. 更新文档 + 提交

**示例提示词：**

```
按 feature-build 流程，实现 Lifecycle.vue 生命周期总体框架页：
后端 API 在 lifecycleFramework.js，需要路由、菜单、列表和权限。
先列验收标准再写代码。
```

```
按 feature-build 做「立项审批流」：含数据库、API、前端、测试清单。
```

---

### 4.6 `infra-docker` — Docker 环境与部署

**适合：** 修改 `docker-compose.yml`、加服务、排容器问题

**提供内容：**

- PostgreSQL 容器配置、healthcheck、volume
- 多服务 Compose 结构
- 本地与团队环境标准化

**示例提示词：**

```
按 infra-docker，在 docker-compose 里为 backend 加健康检查，
并说明 114 服务器部署时需要注意的 volume 路径。
```

```
按 infra-docker 规范，给 platform 增加 Redis 缓存服务及环境变量。
```

**配合脚本：** `platform/deploy/deploy-114.ps1`（一键打包上传 114）

---

### 4.7 `database-design` — 从需求到表结构

**适合：** 新模块开工前的 schema 设计

**工作流程：**

1. 从需求提取实体（项目、用户、文件…）
2. 定义关系（一对多、多对多）
3. 设计字段、索引、约束
4. 输出 ORM 模型草案

**示例提示词：**

```
按 database-design，为「项目结题验收」设计表结构：
含验收材料、审批记录、与 Project 的关联。输出 Prisma schema 草案。
```

---

### 4.8 `db-postgres` — PostgreSQL 实操

**适合：** 改 schema、写迁移、查库、排数据库问题

**提供内容：**

- 表命名、迁移节奏、索引策略
- Docker 本地 PG 配置
- 常见查询与排错

**本项目适配：** Skill 示例基于 **Drizzle ORM**，本项目用 **Prisma**。对话中建议加一句：

```
用 Prisma，不要 Drizzle。以 platform/backend/prisma/schema.prisma 为准。
```

**示例提示词：**

```
按 db-postgres，给 Project 加 closureStatus、closedAt 字段，
生成 Prisma migration 并更新 seed.js。
```

---

## 五、按场景组合使用

```
新功能需求
    │
    ├─► database-design     设计表结构
    ├─► db-postgres         写 Prisma 迁移
    ├─► api-rest            写 Express API
    ├─► using-ui-stack      写 Vue 页面
    └─► visual-qa-testing   截图验收

大功能（跨模块）
    └─► feature-build       统筹全流程
```

| 场景 | 推荐 Skill 组合 | 一句话示例 |
|------|----------------|-----------|
| 新页面 | `ui-design-system` → `using-ui-stack` → `visual-qa-testing` | 「设计并实现 Lifecycle 页，改完做视觉 QA」 |
| 新接口 | `api-rest` | 「按 REST 规范加 /api/admin/audit-log」 |
| 新表/新字段 | `database-design` → `db-postgres` | 「先设计结题表，再写 Prisma migration」 |
| 大功能 | `feature-build` | 「按 feature-build 做立项审批流」 |
| 部署/环境 | `infra-docker` | 「compose 里 backend 加健康检查」 |
| UI 改版 | `ui-design-system` + `using-ui-stack` | 「专业可信风格重做看板六大维度」 |

---

## 六、日常操作建议

1. **使用 Agent 模式** — Chat 模式不会自动按 Skill 写代码  
2. **任务写具体** — 写明页面名、API 路径、表名，触发更准确  
3. **大功能先走 `feature-build`** — 避免只改一半  
4. **UI 改完走 `visual-qa-testing`** — 减少「看起来对、实际有报错」  
5. **注意技术栈差异** — 部分 Skill 面向 Next.js/React/Tailwind，吸收规范思想，语法跟项目走  
6. **数据库统一 Prisma** — `db-postgres` 里的 Drizzle 示例不要照搬  

---

## 七、更新与维护 Skills

### 从上游同步到 `.cursor/skills/`

```powershell
# 1. 更新上游克隆（首次需先 clone，见 .gitignore 注释）
cd "d:\BeiyanCenter\预研项目管理平台\third-party\aussiegingersnap-cursor-skills"
git pull
cd "..\awesome-cursor-skills"
git pull

# 2. 同步到 Cursor 可读目录
cd "d:\BeiyanCenter\预研项目管理平台"
.\platform\deploy\sync-cursor-skills.ps1
```

### 首次克隆上游仓库

```powershell
cd "d:\BeiyanCenter\预研项目管理平台"
mkdir third-party -Force
git clone --depth 1 https://github.com/aussiegingersnap/cursor-skills.git third-party/aussiegingersnap-cursor-skills
git clone --depth 1 https://github.com/spencerpauly/awesome-cursor-skills.git third-party/awesome-cursor-skills
.\platform\deploy\sync-cursor-skills.ps1
```

---

## 八、快速复制：常用提示词模板

### 前端

```
按 ui-design-system，优化 {页面名}.vue：信息密度高、风格专业可信，适配科研人员日常使用。
```

```
用 using-ui-stack 规范统一 {页面名}.vue 的间距、配色和交互状态。
```

```
{页面名}.vue 改完了，按 visual-qa-testing 做截图验收并检查 API 请求。
```

### 后端

```
按 api-rest 规范，在 backend 新增 {功能描述} API，参考现有路由风格。
```

```
按 feature-build 实现 {功能名}：先列验收标准，再写前后端代码。
```

### 数据库

```
按 database-design 设计 {业务模块} 的表结构，输出 Prisma schema 草案。
```

```
按 db-postgres 给 {表名} 加字段并生成 Prisma migration（不要用 Drizzle）。
```

### 部署

```
按 infra-docker 检查 platform/docker-compose.yml，并说明 114 部署注意事项。
```

---

## 九、与本项目关键路径对照

| 用途 | 路径 |
|------|------|
| Skills 安装目录 | `.cursor/skills/` |
| 前端页面 | `platform/frontend/src/views/` |
| 后端 API | `platform/backend/src/index.js` |
| Prisma Schema | `platform/backend/prisma/schema.prisma` |
| Docker Compose | `platform/docker-compose.yml` |
| 114 部署脚本 | `platform/deploy/deploy-114.ps1` |
| Skills 同步脚本 | `platform/deploy/sync-cursor-skills.ps1` |
| 收藏清单 | `docs/CURSOR-SKILLS-收藏清单.md` |

---

## 十、常见问题

**Q：Skill 安装了但 Agent 好像没用上？**  
A：确认在 Agent 模式；任务描述与 Skill 的 `description` 要相关；可手动写「按 xxx skill」强制加载。

**Q：和 Cursor Rules（.mdc）有什么区别？**  
A：Rules 是持久约束（编码风格、项目约定）；Skills 是按需加载的任务手册。二者可并存。

**Q：全局安装和项目安装？**  
A：本项目采用项目级 `.cursor/skills/`，随 Git 同步，团队共享。也可装到 `~/.cursor/skills/` 做个人全局技能。

**Q：能否在 Cursor 设置里远程导入？**  
A：可以。`Ctrl+Shift+J` → Rules → Remote Rule (GitHub)，填入 `https://github.com/aussiegingersnap/cursor-skills`。本项目已本地 vendoring，一般不必重复导入。

---

*文档版本：v1.0 · 对应已安装 8 个 Skills*
