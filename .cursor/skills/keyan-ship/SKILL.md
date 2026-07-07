---
name: keyan-ship
description: >-
  科研项目信息化管理平台专用发布流程。用户提出功能修改、Bug 修复、UI 改版等需求并完成代码后，
  必须将改动以新版本提交 Git、打标签推送 GitHub，并指导或执行 114 服务器部署。
  禁止 force push、禁止覆盖历史。Use when user requests changes, features, fixes,
  or asks to save/deploy/release/sync to GitHub or 114 server.
user-invocable: true
---

# 科研平台 · 版本发布 Skill（keyan-ship）

每次响应用户的**修改需求**时，除完成代码改动外，必须走完本 Skill 的发布流程，确保：

- Git 历史**只增不减**（新 commit + 新 tag，不 amend、不 force push）
- GitHub 上保留全部版本（`v0.2.1`、`v0.2.2` …）
- 114 服务器运行最新构建（`http://10.90.111.114:8084`）

---

## 何时启用

- 用户提出：改功能、修 Bug、改 UI、加页面、改 API、部署、发布、同步 GitHub
- 用户说：「保存到 git」「推 GitHub」「部署 114」「发新版本」
- 用户说：「按 keyan-ship」「按发布流程」

---

## Agent 工作流程（必须按顺序）

### 阶段 1：实现需求

1. 完成用户请求的代码修改（最小必要范围）
2. 自查 linter / 明显错误

### 阶段 2：版本化提交（不覆盖旧版本）

1. 阅读根目录 `VERSION`，下一版本为 **patch +1**（除非用户明确要求 minor/major）
2. 在 `CHANGELOG.md` 顶部追加条目：`## [x.y.z] - 日期` + 变更摘要
3. 更新 `VERSION` 文件为新版本号
4. `git add` 仅相关路径：
   - `platform/`
   - `docs/`
   - `VERSION`、`CHANGELOG.md`
   - `.cursor/skills/`（若 skill 有变）
   - **禁止**提交：`.env`、`third-party/`、`node_modules/`、密钥文件
5. `git commit`，消息格式：

   ```
   <类型>: <简短说明>

   Release: vX.Y.Z
   ```

   类型：`feat` | `fix` | `docs` | `chore` | `style` | `refactor`

6. `git tag vX.Y.Z`（带注释：`git tag -a vX.Y.Z -m "说明"`）

### 阶段 3：推送 GitHub

1. `git pull --rebase origin master`（有未提交本地改动时先 stash）
2. `git push origin master`
3. `git push origin vX.Y.Z`

**禁止：** `git push --force`、`git commit --amend`（除非用户明确且未推送）

### 阶段 4：部署 114

告知用户执行（或 Agent 在用户授权下执行）：

```powershell
cd "d:\BeiyanCenter\预研项目管理平台"
.\platform\deploy\ship-version.ps1 -Message "<与 commit 一致的说明>" -NoCache
```

若**仅推送、暂不部署**：

```powershell
.\platform\deploy\ship-version.ps1 -Message "<说明>" -SkipDeploy
```

若**仅部署、Git 已提交**：

```powershell
.\platform\deploy\deploy-114.ps1 -NoCache
```

---

## 一键脚本（推荐给用户）

| 脚本 | 作用 |
|------|------|
| `platform/deploy/ship-version.ps1` | 版本号 + CHANGELOG + commit + tag + push + 114 部署 |
| `platform/deploy/deploy-114.ps1` | 仅打包上传并 docker compose 构建 |
| `platform/deploy/push-github.ps1` | 仅 push（无版本号时使用） |

### ship-version.ps1 参数

| 参数 | 说明 |
|------|------|
| `-Message` | **必填**，本次变更一句话说明 |
| `-NoCache` | 前端/后端强制重建镜像（UI 改动必加） |
| `-SkipDeploy` | 只提交 GitHub，不部署 114 |
| `-SkipPush` | 只本地 commit+tag，不 push |
| `-Bump patch\|minor\|major` | 版本递增级别，默认 patch |

---

## 114 服务器固定信息

| 项 | 值 |
|----|-----|
| 主机 | `10.90.111.114` |
| 用户 | `yanghuiran` |
| 部署目录 | `/data_SSD_21T/users/yanghuiran/yanghuiran/yuyanplatform/platform` |
| 访问端口 | `8084` |
| 演示密码 | `Keyan@2026`（勿写入仓库） |

SSH/SCP 需用户本机输入密码；Agent 无法代替输入时，**必须给出上述一条命令**让用户执行。

---

## 完成汇报模板

任务结束时向用户汇报：

```markdown
## 已完成
- 改动：<文件与摘要>
- 版本：vX.Y.Z（Git 标签，历史已保留）

## 请你执行（部署到 114）
​```powershell
cd "d:\BeiyanCenter\预研项目管理平台"
.\platform\deploy\ship-version.ps1 -Message "<说明>" -NoCache
​```
（出现密码提示时输入 SSH 密码）

## 验证
- GitHub: https://github.com/Rabit11/paltform/releases/tag/vX.Y.Z
- 114: http://10.90.111.114:8084
```

若 Agent 已成功 push 但未能部署，明确写「Git 已推送，114 需你执行上表命令」。

---

## 版本策略说明（给用户）

- **不会覆盖旧版本**：每次发布是新 commit + 新 tag，旧代码永远在 Git 历史中
- 查看历史：`git log --oneline`、`git tag -l "v*"`
- 回退只读某版本：`git checkout v0.2.0`（ detached HEAD，用于查看）
- 生产回滚 114：在服务器上对应该 tag 的代码重新 `deploy-114.ps1 -NoCache`

---

## 与其他 Skill 的配合

| 场景 | 先做 | 发布后 |
|------|------|--------|
| UI 改版 | `ui-design-system` + `using-ui-stack` | `keyan-ship` + `-NoCache` |
| 新 API | `api-rest` | `keyan-ship` |
| 新表 | `database-design` + `db-postgres` | `keyan-ship` + 114 需 `backend` 重建 |
| 大功能 | `feature-build` | `keyan-ship` |
