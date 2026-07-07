param(
    [string]$TargetHost = "10.90.111.114",
    [string]$TargetUser = "yanghuiran",
    # 114 上 docker compose 实际运行目录
    [string]$RemoteDir = "/data_SSD_21T/users/yanghuiran/yanghuiran/yuyanplatform/platform",
    [int]$Port = 8084,
    [switch]$NoCache
)

$ErrorActionPreference = "Stop"
$PlatformDir = Split-Path -Parent $PSScriptRoot

Write-Host "==> 打包 platform 代码..." -ForegroundColor Cyan
$tarPath = Join-Path $env:TEMP "keyan-platform.tar.gz"
if (Test-Path $tarPath) { Remove-Item $tarPath }

Push-Location $PlatformDir
tar czf $tarPath --exclude=node_modules --exclude=dist --exclude=.git docker-compose.yml .env.example nginx backend frontend deploy
Pop-Location

Write-Host "==> 上传到 ${TargetUser}@${TargetHost}:${RemoteDir} ..." -ForegroundColor Cyan
ssh -p 22 "${TargetUser}@${TargetHost}" "mkdir -p ${RemoteDir}"
scp -P 22 $tarPath "${TargetUser}@${TargetHost}:/tmp/keyan-platform.tar.gz"

$buildFlag = if ($NoCache) { "docker compose build --no-cache backend frontend" } else { "docker compose build backend frontend" }

$remoteScript = @"
set -e
mkdir -p ${RemoteDir}
cd ${RemoteDir}
tar xzf /tmp/keyan-platform.tar.gz
if [ ! -f .env ]; then cp .env.example .env; fi
${buildFlag}
docker compose up -d
docker compose ps
curl -s http://127.0.0.1:${Port}/api/health || true
echo ''
echo '部署完成: http://${TargetHost}:${Port}'
"@

Write-Host "==> 远程构建并启动..." -ForegroundColor Cyan
ssh -p 22 "${TargetUser}@${TargetHost}" $remoteScript

Write-Host "==> 完成! 访问 http://${TargetHost}:${Port}" -ForegroundColor Green
