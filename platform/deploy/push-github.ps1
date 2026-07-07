param(
    # 在 GitHub 新建仓库后填入，例如: https://github.com/你的用户名/keyan-platform.git
    [Parameter(Mandatory = $true)]
    [string]$RepoUrl,

    [string]$Branch = "master"
)

$ErrorActionPreference = "Stop"
$RootDir = Resolve-Path (Join-Path $PSScriptRoot "../..")

Set-Location $RootDir

Write-Host "==> 仓库根目录: $RootDir" -ForegroundColor Cyan
git status

$remote = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "==> 添加远端 origin: $RepoUrl" -ForegroundColor Cyan
    git remote add origin $RepoUrl
} else {
    Write-Host "==> 更新远端 origin: $RepoUrl (原: $remote)" -ForegroundColor Yellow
    git remote set-url origin $RepoUrl
}

Write-Host "==> 推送到 GitHub ($Branch)..." -ForegroundColor Cyan
git push -u origin $Branch

Write-Host "==> 完成! 远端: $RepoUrl" -ForegroundColor Green
