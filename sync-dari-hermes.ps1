# =============================================================
# Ambil perubahan skill yang dibuat agent Hermes (catatan baru di references/,
# revisi SKILL.md) kembali ke repo, supaya bisa di-commit.
# Jalankan:  powershell -ExecutionPolicy Bypass -File .\sync-dari-hermes.ps1
# =============================================================
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$hermes = $env:HERMES_HOME
if (-not $hermes) {
  $hermes = Join-Path $env:LOCALAPPDATA 'hermes'
  if (-not (Test-Path (Join-Path $hermes 'desktop-plugins'))) { $hermes = Join-Path $HOME '.hermes' }
}
$sk = Join-Path $hermes 'skills\kanvas-studio'
if (-not (Test-Path $sk)) { throw "Skill belum terpasang di $sk" }

$tujuan = Join-Path $repo 'skills\kanvas-studio'
Get-ChildItem $sk -Recurse -File | Where-Object { $_.Name -notmatch '\.pyc$' } | ForEach-Object {
  $rel = $_.FullName.Substring($sk.Length + 1)
  $dst = Join-Path $tujuan $rel
  if (-not (Test-Path $dst) -or (Get-FileHash $dst).Hash -ne (Get-FileHash $_.FullName).Hash) {
    New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
    Copy-Item $_.FullName $dst -Force
    Write-Host "  diperbarui: skills\kanvas-studio\$rel"
  }
}
Write-Host "`nSelesai. Cek perubahannya dengan: git status / git diff"
