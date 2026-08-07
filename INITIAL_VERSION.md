# 最初部署版本

本仓库保存的是服务器升级前实际运行的最初版平台代码。

`server/` 和 `web/dist/` 已从服务器保留的原始 Docker 镜像
`f9a250b20118` 中提取，并按原始运行路径归档。仓库不包含业务数据库、
上传文件、登录口令、环境密钥或约 295 MB 的 Docker 离线镜像。

## 按原始运行文件部署

```bash
docker compose -f docker-compose.initial-runtime.yml up -d --build
```

访问地址：`http://服务器IP:18087`

## 数据说明

数据库和精确 Docker 离线镜像保存在独立的本地离线包中，不提交到 GitHub。
部署到新服务器时，可先启动容器生成数据卷，再将经过授权的数据快照恢复到
该数据卷。
