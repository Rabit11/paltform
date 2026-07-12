# 科研项目信息化管理平台 · 交互演示版（SRPM Demo）

依据《科研项目信息化管理平台需求 V18》从零重建的**可交互演示系统**：
深空蓝"任务控制中心"风格前端（React）+ 真实后端数据库（Express + SQLite），
内置 41 个拟真航空科研项目、15 条立项渠道、全谱四色状态与在途审批流程。

## 快速启动

要求：Node.js ≥ 20（演示机已验证 v22）。

```bash
cd platform
npm run setup     # 首次：安装三个工作区依赖
npm run demo      # 造数 → 构建前端 → 一体启动，访问 http://localhost:8787
```

## 服务器容器化部署（推荐给客户演示用）

要求：服务器装有 Docker（含 compose 插件）。

```bash
# 1. 把 platform/ 目录上传到服务器（或 git clone 后 cd platform）
# 2. 可选：配置 AI 识读密钥
cp .env.example .env && vi .env      # 填入 GLM_API_KEY

# 3. 构建并启动（首次启动自动灌注演示数据，四色状态按当天日期锚定）
docker compose up -d --build

# 4. 浏览器访问 http://<服务器IP>:8787
```

运维要点：

| 操作 | 命令 |
|---|---|
| 演示后重置数据 | `docker compose exec srpm node /app/server/src/seed.js` |
| 查看运行日志 | `docker compose logs -f srpm` |
| 改对外端口 | `.env` 中设 `SRPM_PORT=80` 后 `docker compose up -d` |
| 每次重启都重置数据 | compose 中打开 `FORCE_SEED: "1"` |
| 数据持久化 | 数据库与上传文件在命名卷 `srpm-data`，容器重建不丢失 |
| 健康检查 | 镜像内置 HEALTHCHECK（/api/bootstrap），`docker ps` 可见状态 |

镜像为多阶段构建（前端 Vite 构建 → 服务端生产依赖 → node:22-bookworm-slim 运行时，以非 root 用户运行），单容器同时托管 API 与前端静态资源，无需额外反向代理即可演示；如需 HTTPS，可在前面加一层 Nginx/Caddy 转发到 8787。

国内服务器加速小贴士：

```bash
# npm 依赖走国内镜像
docker compose build --build-arg NPM_REGISTRY=https://registry.npmmirror.com
# 基础镜像拉取慢时，为 Docker 配置 registry-mirrors（/etc/docker/daemon.json）后重启 docker
```

开发模式（前端热更新，端口 5173，接口代理到 8787）：

```bash
npm run seed      # 重置演示数据（随时可跑，四色状态按“今天”重新锚定）
npm run dev       # 并行启动 server + vite
```

## 演示账号（登录页直接点选）

| 角色 | 账号 | 看点 |
|---|---|---|
| 管理团队·总部 | 王建国（科研项目处处长） | 可视化驾驶舱、全域台账+导出、审批终审、预警中心、黑名单、后评价 |
| 项目团队 | 林晚晴（上飞院 项目负责人） | 工作台、申报向导（选渠道→差异化材料→生成审签流）、里程碑销项、计划办结、变更 |
| 责任总师 | 陈铁军（一级总师） | 评审工作台：建议书/验收技术把关，通过/退回即时生效 |
| 财务团队 | 赵美玲（上飞公司 财务主管） | 经费执行台账、核销凭证、总部拨付管控（额度/双审/清算） |
| 超级管理员 | 系统管理员 | 渠道字典（15 渠道）、权限矩阵、流程模板、审计日志 |

## 建议演示动线（约 8 分钟）

1. **登录页**：蓝图飞机 + 角色分权入口，点出"一本账、全生命周期、分级管控"定位。
2. **王建国 → 驾驶舱**：KPI 带、四色矩阵、风险预警榜（点击任一风险项穿透到项目详情）。
3. **项目详情（氢电飞机验证机研制）**：生命周期阶段图、里程碑四色时间线、经费、交付物与成果编号联动。
4. **林晚晴 → 项目申报**：选「重点研发计划」→ 材料自适应 → 提交后生成九级审签流（数据实时落库）。
5. **林晚晴 → 里程碑填报**：对黄色节点"上传佐证·销项"，状态当场翻绿。
6. **陈铁军 → 评审工作台**：对刚才的申报做技术把关（通过/退回留痕）。
7. **王建国 → 审批中心**：终审「智能蒙皮」立项备案 → 项目状态自动转"实施中"。
8. **赵美玲 → 总部拨付管控**：批准在途拨付申请，额度台账即时更新。
9. **系统管理员 → 审计日志**：以上所有操作全程留痕，收尾"全程可溯"。

演示后执行 `npm run seed` 即可恢复初始数据。

## 技术栈与结构

```
platform/
├─ server/          Express + better-sqlite3
│  ├─ src/db.js         19 张表结构
│  ├─ src/seed.js       拟真造数（锚定当天，四色分布确定）
│  ├─ src/domain.js     四色状态规则（红>黄>蓝>绿，30 天阈值）
│  ├─ src/api.js        REST API（角色数据权限 + 审批推进 + 审计）
│  └─ test/             node --test 域规则单测
└─ web/             Vite + React 18 + TS + Tailwind CSS v4 + ECharts
   └─ src/
      ├─ theme.css              设计令牌（深空蓝 / 唯一强调色 / 四色语义）
      ├─ components/icons/      自研 SVG 域图标集（22 枚，1.6px 描边）
      ├─ components/art/        蓝图飞机 / 雷达扫描 / 生命周期图（手工 SVG）
      ├─ components/charts/     ECharts 暗色主题封装
      └─ pages/                 登录 + 16 个角色页面
```

## 真实文档上传与 AI 识读

「项目申报」页支持上传真实申报书（PDF / DOCX / TXT）：原件存档至 `server/data/uploads/` 并进入项目文档库（详情页"审批与归档"可下载），AI 自动抽取项目名称、目标、经费、周期、参研单位、渠道判定、里程碑、交付物并预填表单，用户核对修改后提交，里程碑/交付物随项目一并落库。

**AI 供应商配置**（三选一，未配置时自动降级为"本地规则模拟解析"，流程仍可演示）：

```bash
# 方式一：环境变量（推荐 Anthropic 官方）
set ANTHROPIC_API_KEY=sk-ant-api03-xxxx        # Windows PowerShell: $env:ANTHROPIC_API_KEY="..."
set AI_MODEL=claude-sonnet-5                    # 可选，默认即此；省钱可用 claude-haiku-4-5-20251001

# 方式二：配置文件（复制 server/ai.config.example.json → server/ai.config.json 填写）
#   Anthropic:      { "provider": "anthropic", "apiKey": "sk-ant-...", "model": "claude-sonnet-5" }
#   OpenAI 兼容网关: { "provider": "openai", "apiKey": "sk-...", "baseUrl": "https://api.deepseek.com/v1", "model": "deepseek-chat" }
```

配置后重启服务即生效，申报页顶部会显示当前 AI 状态（`GET /api/ai/status`）。
扫描版 PDF（无文本层）在 Anthropic 通道下会自动改传 PDF 原件由模型视觉识读。

## 与需求 V18 的对应

- 三级 15 渠道分类体系、渠道编码唯一（§二(一)）
- 五类角色与数据权限（§二(二)）：team 仅本人项目 / 总师只读 / 单位角色限本单位 / 总部全量+导出 / 管理员禁改业务数据
- 全局四色状态与 30 天预警（§二(四)）：后端按到期日实时计算，站内+邮箱+蓝信推送标识
- 六大功能域（§三）：项目总览（台账+驾驶舱）、立项（差异化材料+审签）、实施（里程碑/CMOS计划/双轨经费/评估/两类变更）、验收（分级+交付物+协作评价）、成果转化（成果包/两级形式联动）、后评价（>1亿、3年内）
- 协作单位五维评分四档定级，不合格自动纳入黑名单（§四(三)）

> 本演示为业务演示用途：登录为角色直选（无密码）、附件上传为模拟动作、CMOS/经费系统对接以"已同步"仿真数据呈现。
