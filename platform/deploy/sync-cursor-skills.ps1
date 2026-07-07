# 从 third-party 上游仓库同步推荐 Skills 到 .cursor/skills/
# 首次使用请先克隆：
#   git clone --depth 1 https://github.com/aussiegingersnap/cursor-skills.git third-party/aussiegingersnap-cursor-skills
#   git clone --depth 1 https://github.com/spencerpauly/awesome-cursor-skills.git third-party/awesome-cursor-skills

$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$skillsDir = Join-Path $root ".cursor\skills"
$third = Join-Path $root "third-party"

$aussieRepo = Join-Path $third "aussiegingersnap-cursor-skills"
$awesomeRepo = Join-Path $third "awesome-cursor-skills"

if (-not (Test-Path $aussieRepo)) {
    Write-Host "缺少 $aussieRepo，请先 git clone aussiegingersnap/cursor-skills" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $awesomeRepo)) {
    Write-Host "缺少 $awesomeRepo，请先 git clone awesome-cursor-skills" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path $skillsDir | Out-Null

foreach ($s in @('ui-design-system','api-rest','feature-build','infra-docker','db-postgres')) {
    $dst = Join-Path $skillsDir $s
    if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
    Copy-Item -Recurse -Force (Join-Path $aussieRepo "skills\$s") $dst
    Write-Host "synced $s"
}

$awesome = @{
    'visual-qa-testing' = 'resources\visual-qa-testing'
    'using-ui-stack'      = 'resources\using-ui-stack'
    'database-design'     = 'resources\database-design'
}
foreach ($name in $awesome.Keys) {
    $dst = Join-Path $skillsDir $name
    if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
    Copy-Item -Recurse -Force (Join-Path $awesomeRepo $awesome[$name]) $dst
    Write-Host "synced $name"
}

Write-Host "完成：$skillsDir" -ForegroundColor Green
