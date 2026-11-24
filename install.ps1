# =============================================================
# Install Kanvas Studio into Hermes Desktop (plugin + agent skill)
# Run from the repo folder:  powershell -ExecutionPolicy Bypass -File .\install.ps1
# =============================================================
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot

# Lokasi data Hermes: HERMES_HOME, lalu %LOCALAPPDATA%\hermes, lalu ~\.hermes
$hermes = $env:HERMES_HOME
if (-not $hermes) {
  $hermes = Join-Path $env:LOCALAPPDATA 'hermes'
  if (-not (Test-Path (Join-Path $hermes 'desktop-plugins'))) { $hermes = Join-Path $HOME '.hermes' }
}
if (-not (Test-Path $hermes)) { throw "Hermes folder not found ($hermes). Set HERMES_HOME first." }
Write-Host "Hermes: $hermes"

# 1. Plugin desktop
$dp = Join-Path $hermes 'desktop-plugins\kanvas-studio'
New-Item -ItemType Directory -Force -Path $dp | Out-Null
Copy-Item (Join-Path $repo 'desktop\plugin.js') (Join-Path $dp 'plugin.js') -Force
Write-Host "  plugin  -> $dp\plugin.js"
# data ikon untuk pemilih ikon di plugin (dibaca dari folder data plugin)
$dataPlugin = Join-Path $env:APPDATA 'Hermes\plugin-files\data\kanvas-studio'
New-Item -ItemType Directory -Force -Path $dataPlugin | Out-Null
Copy-Item (Join-Path $repo 'app\dist\ikon.json') (Join-Path $dataPlugin 'ikon.json') -Force
Copy-Item (Join-Path $repo 'app\dist\template.json') (Join-Path $dataPlugin 'template.json') -Force
Write-Host "  icons   -> $dataPlugin\ikon.json"

# 2. Skill agent (SKILL.md + alat cek). Catatan di references/ yang lebih baru di Hermes tidak ditimpa.
$sk = Join-Path $hermes 'skills\kanvas-studio'
New-Item -ItemType Directory -Force -Path (Join-Path $sk 'references') | Out-Null
foreach ($f in 'SKILL.md', 'kanvas_cek.py') { Copy-Item (Join-Path $repo "skills\kanvas-studio\$f") (Join-Path $sk $f) -Force }
Get-ChildItem (Join-Path $repo 'skills\kanvas-studio\references') -File | ForEach-Object {
  $tujuan = Join-Path $sk "references\$($_.Name)"
  if (-not (Test-Path $tujuan) -or (Get-Item $tujuan).LastWriteTime -lt $_.LastWriteTime) { Copy-Item $_.FullName $tujuan -Force; Write-Host "  notes   -> $tujuan" }
  else { Write-Host "  note in Hermes is newer, kept: $($_.Name)  (run sync-dari-hermes.ps1 to copy it into the repo)" }
}
Write-Host "  skill   -> $sk"
Write-Host "`nDone. In Hermes Desktop: Capabilities -> Plugins -> make sure 'Kanvas Studio' is on (or Ctrl+K -> Reload desktop plugins)."
