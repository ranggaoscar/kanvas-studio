// Pengganti "@hermes/plugin-sdk" untuk app lokal (di luar Hermes).
// UI kanvas (desktop/plugin.js) dipakai apa adanya; host ini menyediakan hal-hal yang biasanya diberi Hermes.
import { createElement, useSyncExternalStore } from 'react'

const atom = v => {
  const subs = new Set()
  return { get: () => v, set: n => { v = n; subs.forEach(f => f()) }, subscribe: f => { subs.add(f); return () => subs.delete(f) } }
}
export const useValue = a => useSyncExternalStore(a.subscribe, a.get)
export const Button = ({ children, variant, size, ...p }) => createElement('button', { className: 'kv-btn kv-btn-' + (variant || 'primary'), ...p }, children)
export const PANES_AREA = 'panes', ROUTES_AREA = 'routes', SIDEBAR_NAV_AREA = 'nav', PALETTE_AREA = 'palette'
export const STATUSBAR_AREAS = null   // app lokal tidak punya status bar Hermes
export const KEYBINDS_AREA = null

function toast(message) {
  let box = document.getElementById('kv-toast')
  if (!box) { box = document.createElement('div'); box.id = 'kv-toast'; document.body.append(box) }
  const t = document.createElement('div'); t.className = 'kv-toast'; t.textContent = message; box.append(t)
  setTimeout(() => t.classList.add('pergi'), 3200); setTimeout(() => t.remove(), 3700)
}

// Optional ctx.documentAction capability. The shared UI passes File objects
// for imports and receives a Blob for Excel downloads in either host.
export function createDocumentAction(api) {
  return async ({ file, folder, ...action }) => {
    if (folder && folder !== 'data') return { ok: false, message: 'Pilih ruang kerja Kanvas untuk membuka dokumen ini.' }
    if (file) {
      if (!file.size || file.size > 64 * 1024 * 1024) return { ok: false, message: 'Pilih file berisi data dengan ukuran maksimal 64 MiB.' }
      const url = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(Error('File tidak dapat dibaca. Coba pilih kembali.'))
        reader.readAsDataURL(file)
      })
      action.upload = { name: file.name, base64: url.slice(url.indexOf(',') + 1) }
    }
    const excel = action.action === 'export_xlsx', pdf = action.action === 'export_pdf'
    const result = await api('document', excel || pdf ? { ...action, returnBytes: true } : action)
    if (!result?.ok) {
      const pesan = result?.error === 'not-found' ? 'Host ini belum mendukung fitur dokumen. Buka Kanvas Studio lokal versi terbaru.'
        : result?.message?.includes('No editable table') ? 'Belum ada tabel yang dapat diunduh. Impor Excel atau CSV untuk membuat draft laporan berisi tabel.'
        : result?.message?.includes('Windows.Data.Pdf') ? 'Pembacaan PDF eksternal tersedia di Kanvas Studio lokal pada Windows.'
        : /Command failed:|Invalid PDF|Missing PDF trailer|Invalid hybrid/i.test(result?.message || '') ? 'PDF belum bisa dibaca. Periksa apakah file rusak atau dilindungi kata sandi.'
        : result?.message || 'Host dokumen tidak merespons. Coba lagi.'
      return { ok: false, message: pesan, unsupported: result?.error === 'not-found' || result?.message === 'Unknown document action' }
    }
    if (!excel && !pdf) return result
    if (typeof result.base64 !== 'string') return { ok: false, message: 'Host belum mendukung unduhan ini. Perbarui Kanvas Studio lokal.', unsupported: true }
    const data = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0))
    return { ok: true, blob: new Blob([data], { type: pdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) }
  }
}

export const host = {
  notify: ({ message }) => toast(message),
  notifyError: (e, m) => toast(m || String(e)),
  navigate: () => {},
  // tidak ada kotak chat di app lokal → mintaAgent jatuh ke "salin ke clipboard"
  composer: { insertText: async () => false, focus: () => {} },
  state: { busyBySession: atom({}), focusedSessionId: atom('agent'), busy: atom(false) }
}
