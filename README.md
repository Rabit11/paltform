# 科研项目信息化管理平台 (SRPM)

现网对照：`36.212.172.150:18087` 容器 `srpm-18087`。默认端口 18087。本仓库为**正在运行的应用代码**，不含业务数据库。

## 结构
- `server/` 后端（`index.js` 含 `/healthz`、表单工具反向代理）
- `web/dist/` 前端：主 SPA 为 `assets/index-StageFill01.js`，含预研大屏 `pre-research.html`
- `deploy/` Docker Compose 与离线部署脚本
- `Dockerfile`

## 登录
工号即初始密码。管理员 `100001`。

## 部署
见 `deploy/部署步骤.txt`。更新镜像不要删除数据卷 `platform_srpm-data`。不要对 8092 表单维护容器执行 `docker-compose down -v`。
