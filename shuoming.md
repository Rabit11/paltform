可以，已经帮你写好了 **Skill + 一键脚本**，以后每次改需求都按「新版本进 Git → 推 GitHub → 部署 114」走，**不会覆盖历史**。

---

## 已创建内容

| 文件 | 作用 |
|------|------|
| `.cursor/skills/keyan-ship/SKILL.md` | Agent 专用发布流程 Skill |
| `platform/deploy/ship-version.ps1` | 一键：版本号 + CHANGELOG + commit + tag + push + 114 |
| `VERSION` | 当前版本 `0.2.0` |
| `CHANGELOG.md` | 变更记录（每次在顶部追加） |

---

## 版本怎么「不覆盖」？

Git 每次发布是：

1. **新 commit**（历史都在）
2. **新标签** `v0.2.1`、`v0.2.2` …
3. 推送到 GitHub，旧版本永远可查看、可回滚

不会 `force push`，不会删掉以前的提交。

---

## 你以后怎么用？

### 方式 1：提需求时顺带说一句（推荐）

```
按 keyan-ship 流程：修改 XXX，完成后发布新版本并部署 114
```

Agent 会：改代码 → 升版本 → 提交 → 告诉你执行部署命令。

### 方式 2：改完后你自己一条命令

```powershell
cd "d:\BeiyanCenter\预研项目管理平台"
.\platform\deploy\ship-version.ps1 -Message "看板钢蓝主题改版" -NoCache
```

这一条会自动：

- `0.2.0` → `0.2.1`（patch +1）
- 写 `CHANGELOG.md`
- `git commit` + `git tag v0.2.1`
- `git push` + 推标签
- 部署到 **114:8084**（提示输入 SSH 密码）

### 只推 GitHub、暂不部署 114

```powershell
.\platform\deploy\ship-version.ps1 -Message "说明" -SkipDeploy
```

---

## Skill 触发场景

以后你说这些，Agent 应自动读 `keyan-ship`：

- 改功能 / 修 Bug / 改 UI
- 「保存 git」「推 GitHub」「部署 114」「发新版本」
- 「按 keyan-ship」

---

## 查看历史版本

```powershell
git log --oneline
git tag -l "v*"
```

GitHub：https://github.com/Rabit11/paltform/tags

---

需要我把 `keyan-ship` Skill、`ship-version.ps1` 和当前 Board 改动也 **commit 并 push 到 GitHub** 吗？你说一声我帮你做第一次 `v0.2.1` 发布。
