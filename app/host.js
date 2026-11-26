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

// Local BYOK / Ollama chat host implementing the cloud-ready host.chat contract.
// Other hosts (such as kanvas-studio-cloud) can replace host.chat with their own
// streaming endpoint plus an optional renderSlot() for credits without forking desktop/plugin.js.
export function createLocalChat(api) {
  async function readAttachment(item) {
    if (!item) return null
    if (typeof item.base64 === 'string' && typeof item.name === 'string') return item
    const file = item.file || item
    if (typeof File !== 'undefined' && file instanceof File) {
      if (!file.size || file.size > 32 * 1024 * 1024) throw Error(`Ukuran file "${file.name}" harus antara 1 B hingga 32 MiB.`)
      const url = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(Error(`File "${file.name}" gagal dibaca.`))
        reader.readAsDataURL(file)
      })
      return { name: file.name, mimeType: file.type || '', base64: url.slice(url.indexOf(',') + 1) }
    }
    return null
  }

  async function chat({ prompt = '', attachments = [], file = null, artboard = null, selection = [], history = [], signal, onEvent } = {}) {
    const encoded = []
    for (const att of attachments) {
      const item = await readAttachment(att)
      if (item) encoded.push(item)
    }
    let res
    try {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'X-Kanvas': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, attachments: encoded, file, artboard, selection, history }),
        signal
      })
    } catch (e) {
      const aborted = e?.name === 'AbortError'
      const err = { type: 'error', code: aborted ? 'aborted' : 'network-error', message: aborted ? 'Permintaan dihentikan.' : 'Tidak dapat menghubungi server lokal Kanvas Studio.' }
      onEvent?.(err)
      return { ok: false, ...err }
    }
    if (!res.ok || !res.body) {
      const err = { type: 'error', code: 'http-error', message: `Server chat mengembalikan HTTP ${res.status}.` }
      onEvent?.(err)
      return { ok: false, ...err }
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = '', finalResult = null
    const dispatchBlock = block => {
      const lines = block.split(/\r?\n/)
      let evtName = 'message'
      const dataLines = []
      for (const ln of lines) {
        if (ln.startsWith('event:')) evtName = ln.slice(6).trim()
        else if (ln.startsWith('data:')) dataLines.push(ln.slice(5).trim())
      }
      if (!dataLines.length) return
      let payload
      try { payload = JSON.parse(dataLines.join('\n')) } catch { return }
      const evt = { type: payload.type || evtName, ...payload }
      onEvent?.(evt)
      if (evt.type === 'done') finalResult = { ok: true, ...evt }
      else if (evt.type === 'error') finalResult = { ok: false, ...evt }
    }
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let sepIdx
        while ((sepIdx = buf.search(/\r?\n\r?\n/)) >= 0) {
          const matchLen = buf.slice(sepIdx).startsWith('\r\n\r\n') ? 4 : 2
          const block = buf.slice(0, sepIdx)
          buf = buf.slice(sepIdx + matchLen)
          if (block.trim()) dispatchBlock(block)
        }
      }
      if (buf.trim()) dispatchBlock(buf)
    } catch (e) {
      const aborted = e?.name === 'AbortError'
      const err = { type: 'error', code: aborted ? 'aborted' : 'stream-error', message: aborted ? 'Permintaan dihentikan.' : (e?.message || 'Koneksi streaming terputus.') }
      onEvent?.(err)
      return { ok: false, ...err }
    }
    return finalResult || { ok: true, text: '' }
  }

  chat.mode = 'byok'
  chat.getConfig = () => api('chat/config')
  chat.saveConfig = cfg => api('chat/config', cfg)
  return chat
}

export const host = {
  notify: ({ message }) => toast(message),
  notifyError: (e, m) => toast(m || String(e)),
  navigate: () => {},
  // tidak ada kotak chat Hermes di app lokal → app/main.js mengaktifkan host.chat untuk Floating Prompt Bar
  composer: { insertText: async () => false, focus: () => {} },
  state: { busyBySession: atom({}), focusedSessionId: atom('agent'), busy: atom(false) },
  chat: null
}
