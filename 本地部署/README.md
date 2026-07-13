# 本地部署

本目录存放可在本机直接运行的 SRPM 平台部署包，与源码目录 `research_proj_mgmt/platform/` 分离，便于演示、交付和备份。

## 目录说明

```
本地部署/
├─ srpm-platform/       可部署的项目文件（由 package-local.ps1 同步生成）
├─ package-local.ps1      从源码目录打包/同步到本目录
├─ start-docker.cmd       Docker 方式启动（推荐）
├─ start-node.cmd         Node 直接启动（需已安装 Node.js ≥ 20）
└─ README.md              本说明
```

## 首次使用

### 方式一：Docker（推荐）

要求：已安装 Docker Desktop（含 compose 插件）。

```powershell
cd 本地部署
.\package-local.ps1          # 从源码同步最新文件（首次或更新后执行）
.\start-docker.cmd           # 构建并启动，默认 http://127.0.0.1:8787
```

### 方式二：Node 直接运行

要求：Node.js ≥ 20。

```powershell
cd 本地部署
.\package-local.ps1
.\start-node.cmd             # 造数 → 构建前端 → 启动，默认 http://127.0.0.1:8787
```

## 更新部署包

源码有变更时，在 `本地部署` 目录下重新执行：

```powershell
.\package-local.ps1
```

然后按上述方式重启服务即可。

## 演示账号

登录页可直接点选角色进入，详见 `srpm-platform/README.md`。
