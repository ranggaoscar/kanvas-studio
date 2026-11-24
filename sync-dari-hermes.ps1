# =============================================================
# Copy skill edits made by Hermes (new notes in references/,
# SKILL.md revisions) back into this repo so they can be committed.
# Run:  powershell -ExecutionPolicy Bypass -File .\sync-dari-hermes.ps1
# =============================================================
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$hermes = $env:HERMES_HOME
if (-not $hermes) {
  $hermes = Join-Path $env:LOCALAPPDATA 'hermes'
  if (-not (Test-Path (Join-Path $hermes 'desktop-plugins'))) { $hermes = Join-Path $HOME '.hermes' }
}
$sk = Join-Path $hermes 'skills\kanvas-studio'
if (-not (Test-Path $sk)) { throw "Skill is not installed at $sk" }

$tujuan = Join-Path $repo 'skills\kanvas-studio'
Get-ChildItem $sk -Recurse -File | Where-Object { $_.Name -notmatch '\.pyc$' } | ForEach-Object {
  $rel = $_.FullName.Substring($sk.Length + 1)
  $dst = Join-Path $tujuan $rel
  if (-not (Test-Path $dst) -or (Get-FileHash $dst).Hash -ne (Get-FileHash $_.FullName).Hash) {
    New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
    Copy-Item $_.FullName $dst -Force
    Write-Host "  updated: skills\kanvas-studio\$rel"
  }
}
Write-Host "`nDone. Check changes with: git status / git diff"
