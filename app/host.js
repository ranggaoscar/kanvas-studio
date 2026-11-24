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

export const host = {
  notify: ({ message }) => toast(message),
  notifyError: (e, m) => toast(m || String(e)),
  navigate: () => {},
  // tidak ada kotak chat di app lokal → mintaAgent jatuh ke "salin ke clipboard"
  composer: { insertText: async () => false, focus: () => {} },
  state: { busyBySession: atom({}), focusedSessionId: atom('agent'), busy: atom(false) }
}
