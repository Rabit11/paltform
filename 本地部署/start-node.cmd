@echo off
cd /d "%~dp0srpm-platform"
if not exist package.json (
    echo 请先运行 package-local.ps1 同步部署文件
    exit /b 1
)
if not exist node_modules (
    echo 正在安装依赖...
    call npm run setup
    if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%
)
echo 正在造数、构建并启动...
call npm run demo
