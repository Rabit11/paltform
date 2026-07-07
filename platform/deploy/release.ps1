param(
    [Parameter(Mandatory = $true)]
    [string]$RepoUrl,
    [string]$Branch = "master",
    [string]$TargetHost = "10.90.111.114",
    [string]$TargetUser = "yanghuiran",
    [string]$RemoteDir = "/data_SSD_21T/users/yanghuiran/yanghuiran/yuyanplatform/platform",
    [switch]$NoCache,
    [switch]$SkipPush,
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
$DeployDir = $PSScriptRoot

if (-not $SkipPush) {
    & (Join-Path $DeployDir "push-github.ps1") -RepoUrl $RepoUrl -Branch $Branch
}

if (-not $SkipDeploy) {
    $args = @{
        TargetHost = $TargetHost
        TargetUser = $TargetUser
        RemoteDir  = $RemoteDir
    }
    if ($NoCache) { $args.NoCache = $true }
    & (Join-Path $DeployDir "deploy-114.ps1") @args
}

Write-Host "==> 发布流程结束 (push + 114 部署)" -ForegroundColor Green
