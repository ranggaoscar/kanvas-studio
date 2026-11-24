// Render desain lewat Chrome/Edge headless + render.html (engine yang sama dengan kanvas).
// Hasil: PNG/JPG (data URL), SVG (teks), atau PDF, plus hasil pemeriksaan desain.
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const KANDIDAT = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')],
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/snap/bin/chromium']
}
export function cariBrowser() {
  if (process.env.KANVAS_BROWSER && existsSync(process.env.KANVAS_BROWSER)) return process.env.KANVAS_BROWSER
  return (KANDIDAT[process.platform] || KANDIDAT.linux).find(p => p && existsSync(p)) || null
}

// lingkungan minimal untuk proses browser anak: jangan teruskan token/API key dari host (Hermes/agent)
const ENV_AMAN = ['PATH', 'PATHEXT', 'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA',
  'TEMP', 'TMP', 'TMPDIR', 'SystemRoot', 'WINDIR', 'COMSPEC', 'ProgramFiles', 'ProgramFiles(x86)', 'CommonProgramFiles',
  'DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'DBUS_SESSION_BUS_ADDRESS',
  'LANG', 'LC_ALL', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy']
export function envMinimal(sumber = process.env) {
  const out = {}
  for (const k of ENV_AMAN) if (sumber[k] !== undefined) out[k] = sumber[k]
  return out
}

export async function render(studio, { file, artboard, format = 'png', skala = 1 }) {
  const browser = cariBrowser()
  if (!browser) return { ok: false, error: 'Chrome or Edge not found. Install Google Chrome or set KANVAS_BROWSER.' }
  const q = new URLSearchParams({ file, format, skala: String(skala) }); if (artboard) q.set('artboard', artboard)
  // halaman bisa "selesai" sebelum font/gambar dari jaringan siap → ulangi sekali dengan waktu lebih panjang
  for (const anggaran of [20000, 60000]) {
    const profil = mkdtempSync(join(tmpdir(), 'kanvas-render-'))
    try {
      const out = await new Promise((ok, gagal) => execFile(browser, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
        `--virtual-time-budget=${anggaran}`, `--user-data-dir=${profil}`, '--dump-dom', `${studio.url}/render.html?${q}`
      ], { env: envMinimal(), maxBuffer: 512 * 1024 * 1024, timeout: 150000, windowsHide: true }, (e, stdout) => e && !stdout ? gagal(e) : ok(stdout)))
      const m = out.match(/<pre id="out">([\s\S]*?)<\/pre>/)
      if (!m || !m[1].trim()) continue
      const teks = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      return JSON.parse(teks)
    } finally { rmSync(profil, { recursive: true, force: true }) }
  }
  return { ok: false, error: 'Render failed (empty page). Check the internet connection for fonts, or try again.' }
}
