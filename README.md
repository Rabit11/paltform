# 科研项目信息化管理平台 V19

本仓库用于归档科研项目信息化管理平台 V19 二次开发代码、部署文件和需求跟进材料。

## 目录结构

- `research_proj_mgmt/platform/`：平台源码与部署文件，包含前端、后端、Dockerfile、docker-compose 和启动脚本。
- `research_proj_mgmt/docs/`：开发说明、功能完善情况说明、平台功能对照矩阵和截图附件。
- `需求跟进材料/`：需求 V18/V19 原始文档、批注整理、二次反馈记录和 V19 功能更新对照矩阵。

## 本机运行

进入平台目录后可使用 Docker 运行：

```powershell
cd research_proj_mgmt/platform
docker compose up -d --build
```

默认访问地址为：

```text
http://127.0.0.1:8787
```

此前本机演示使用端口 `18088` 映射容器服务。

## 重要文档

- `research_proj_mgmt/docs/V19二次开发功能完善情况说明.html`
- `research_proj_mgmt/docs/V19二次功能补充开发说明.md`
- `需求跟进材料/待补充更新需求V19-平台功能更新V19对照矩阵.html`

## 提交说明

仓库不提交 `node_modules`、构建产物、运行数据库、日志、`.env` 和 Office 临时锁文件。运行数据可通过后端种子脚本或 Docker 启动入口重新生成。
