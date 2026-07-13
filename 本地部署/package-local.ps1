# Sync deployable files from research_proj_mgmt/platform to local-deploy/srpm-platform
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Src = Join-Path (Split-Path -Parent $Root) "research_proj_mgmt\platform"
$Dst = Join-Path $Root "srpm-platform"

$SkipDirs = @("node_modules", ".git", "dist", "data", "__pycache__")
$SkipFiles = @(".env")

if (-not (Test-Path $Src)) {
    Write-Error "Source not found: $Src"
}

Write-Host "Syncing deploy files..."
Write-Host "  from: $Src"
Write-Host "  to:   $Dst"

if (Test-Path $Dst) {
    Remove-Item -Recurse -Force $Dst
}
New-Item -ItemType Directory -Path $Dst | Out-Null

function Should-Skip([string]$RelPath) {
    $parts = $RelPath -split "[\\/]"
    foreach ($p in $parts) {
        if ($SkipDirs -contains $p) { return $true }
    }
    if ($SkipFiles -contains (Split-Path -Leaf $RelPath)) { return $true }
    if ($RelPath -match "\.log$") { return $true }
    return $false
}

$count = 0
Get-ChildItem -Path $Src -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($Src.Length + 1)
    if (Should-Skip $rel) { return }
    $target = Join-Path $Dst $rel
    $dir = Split-Path -Parent $target
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    Copy-Item -Path $_.FullName -Destination $target -Force
    $count++
}

Copy-Item (Join-Path $Src ".env.example") (Join-Path $Dst ".env.example") -Force

Write-Host "Synced $count files."
Write-Host "Done."
