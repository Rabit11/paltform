@echo off
cd /d "%~dp0srpm-platform"
if not exist docker-compose.yml (
    echo 请先运行 package-local.ps1 同步部署文件
    exit /b 1
)
if not exist .env (
    copy .env.example .env >nul
    echo 已创建 .env（可按需修改端口与 AI 密钥）
)
docker compose up -d --build
if %ERRORLEVEL% equ 0 (
    echo.
    echo 启动完成，访问 http://127.0.0.1:8787
    echo 查看日志: docker compose logs -f srpm
)
