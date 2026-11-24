// Community Ecosystem loader & manager for Kanvas Studio (P2).
// Pure JSON data extensions stored in <workspace>/community/ (templates, aesthetic directions, workflows).
// Zero arbitrary code execution — strictly schema-validated JSON only.
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { jalur, tulisAtomik, kesalahan } from './ruang.js'
import { normalisasi } from './ops.js'

const DIRS = {
  template: 'community/templates',
  direction: 'community/directions',
  workflow: 'community/workflows'
}

function slug(raw) {
  const s = String(raw || '').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
  if (!s || !/^[a-z0-9](?:[a-z0-9-]{0,47})$/.test(s)) throw kesalahan('invalid-id', 'Community item id must contain letters or numbers.')
  return s
}

function readJsonDir(relDir, suffix = '.json') {
  const abs = jalur(relDir)
  if (!existsSync(abs)) return []
  const out = []
  for (const name of readdirSync(abs).sort()) {
    if (!name.endsWith(suffix) || name.startsWith('.')) continue
    try {
      const data = JSON.parse(readFileSync(join(abs, name), 'utf8'))
      out.push({ file: `${relDir}/${name}`, data })
    } catch {}
  }
  return out
}

export function loadCommunityTemplates() {
  return readJsonDir(DIRS.template, '.kanvas.json')
    .map(x => x.data)
    .filter(d => d && Array.isArray(d.artboards) && d.artboards.length && d.meta?.id)
}

export function loadCommunityDirections() {
  const map = {}
  for (const { data } of readJsonDir(DIRS.direction, '.json')) {
    if (data && data.id && data.name && Array.isArray(data.palettes) && data.palettes.length && Array.isArray(data.fontPairings) && data.fontPairings.length) {
      map[data.id] = data
    }
  }
  return map
}

export function loadCommunityWorkflows() {
  return readJsonDir(DIRS.workflow, '.json')
    .map(x => x.data)
    .filter(w => w && w.id && w.name && Array.isArray(w.steps))
}

export function listCommunity() {
  const templates = loadCommunityTemplates().map(t => ({
    id: t.meta.id, name: t.meta.nama || t.judul, category: t.meta.kategori || 'community',
    description: t.meta.deskripsi || '', author: t.meta.author || 'local',
    artboards: t.artboards.length
  }))
  const directions = Object.values(loadCommunityDirections()).map(d => ({
    id: d.id, name: d.name, summary: d.summary || '', author: d.author || 'local'
  }))
  const workflows = loadCommunityWorkflows().map(w => ({
    id: w.id, name: w.name, description: w.description || '', author: w.author || 'local', steps: w.steps.length
  }))
  return { templates, directions, workflows }
}

export function saveCommunityTemplate({ id, name, category = 'community', description = '', author = 'community', doc }) {
  if (!doc || !Array.isArray(doc.artboards) || !doc.artboards.length) {
    throw kesalahan('invalid-template', 'A valid design document with at least one artboard is required.')
  }
  const tid = slug(id || name || doc.judul)
  const clean = normalisasi(JSON.parse(JSON.stringify(doc)))
  delete clean.komentar
  clean.meta = {
    id: tid,
    nama: String(name || clean.judul || tid).slice(0, 80),
    kategori: String(category).slice(0, 32),
    deskripsi: String(description).slice(0, 220),
    author: String(author).slice(0, 60),
    community: true
  }
  const rel = `${DIRS.template}/${tid}.kanvas.json`
  tulisAtomik(jalur(rel), JSON.stringify(clean, null, 2))
  return { id: tid, path: rel, meta: clean.meta }
}

export function saveCommunityDirection({ id, name, summary, keywords = [], marginRatio = 0.07, fontPairings, palettes, compositions = ['asymmetric-split', 'editorial-grid'], surfaceRules = '', typographyRules = '', author = 'community' }) {
  if (!name || !summary) throw kesalahan('invalid-direction', 'Direction requires "name" and "summary".')
  if (!Array.isArray(fontPairings) || !fontPairings.length) throw kesalahan('invalid-direction', 'Direction requires at least one entry in "fontPairings": [{ display, body, mono?, mood? }].')
  if (!Array.isArray(palettes) || !palettes.length) throw kesalahan('invalid-direction', 'Direction requires at least one entry in "palettes": [{ name, bg, surface, text, muted, accent, rule? }].')
  const did = slug(id || name)
  const entry = {
    id: did,
    name: String(name).trim().slice(0, 64),
    summary: String(summary).trim().slice(0, 260),
    keywords: Array.isArray(keywords) ? keywords.map(k => String(k).toLowerCase().trim()).filter(Boolean).slice(0, 24) : [],
    marginRatio: Math.max(0.03, Math.min(0.16, Number(marginRatio) || 0.07)),
    fontPairings: fontPairings.slice(0, 6).map(f => ({
      display: String(f.display || 'Plus Jakarta Sans').slice(0, 60),
      body: String(f.body || 'Inter').slice(0, 60),
      mono: String(f.mono || 'IBM Plex Mono').slice(0, 60),
      mood: String(f.mood || 'custom').slice(0, 60)
    })),
    palettes: palettes.slice(0, 6).map(p => ({
      name: String(p.name || 'Custom').slice(0, 60),
      bg: String(p.bg || '#FFFFFF'),
      surface: String(p.surface || '#F4F5F8'),
      text: String(p.text || '#111111'),
      muted: String(p.muted || '#555555'),
      accent: String(p.accent || '#E03E2D'),
      rule: String(p.rule || '#CBD5E1')
    })),
    compositions: Array.isArray(compositions) && compositions.length ? compositions.slice(0, 4).map(String) : ['asymmetric-split'],
    surfaceRules: String(surfaceRules || 'Keep surfaces clean and aligned to the visual direction.').slice(0, 320),
    typographyRules: String(typographyRules || 'Maintain strong display-to-body contrast and readable line lengths.').slice(0, 320),
    author: String(author).slice(0, 60),
    community: true
  }
  const rel = `${DIRS.direction}/${did}.json`
  tulisAtomik(jalur(rel), JSON.stringify(entry, null, 2))
  return { id: did, path: rel, direction: entry }
}

export function saveCommunityWorkflow({ id, name, description = '', steps = [], author = 'community', tags = [] }) {
  if (!name || !Array.isArray(steps) || !steps.length) {
    throw kesalahan('invalid-workflow', 'Workflow requires "name" and non-empty "steps" array.')
  }
  const wid = slug(id || name)
  const entry = {
    id: wid,
    name: String(name).trim().slice(0, 80),
    description: String(description).trim().slice(0, 260),
    author: String(author).slice(0, 60),
    tags: Array.isArray(tags) ? tags.map(t => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 10) : [],
    steps: steps.slice(0, 20).map((s, i) => typeof s === 'string'
      ? { order: i + 1, action: s.slice(0, 260) }
      : { order: i + 1, tool: s.tool ? String(s.tool).slice(0, 48) : undefined, action: String(s.action || s.note || '').slice(0, 260) }),
    community: true
  }
  const rel = `${DIRS.workflow}/${wid}.json`
  tulisAtomik(jalur(rel), JSON.stringify(entry, null, 2))
  return { id: wid, path: rel, workflow: entry }
}

export function getCommunityWorkflow(id) {
  const wid = slug(id)
  const abs = jalur(`${DIRS.workflow}/${wid}.json`)
  if (!existsSync(abs)) return null
  return JSON.parse(readFileSync(abs, 'utf8'))
}

export function deleteCommunityItem(kind, id) {
  const k = String(kind || '').toLowerCase()
  if (!DIRS[k]) throw kesalahan('invalid-kind', 'kind must be: template, direction, or workflow.')
  const itemSlug = slug(id)
  const ext = k === 'template' ? '.kanvas.json' : '.json'
  const abs = jalur(`${DIRS[k]}/${itemSlug}${ext}`)
  if (!existsSync(abs)) throw kesalahan('not-found', `Community ${k} "${itemSlug}" not found.`)
  rmSync(abs, { force: true })
  return { deleted: itemSlug, kind: k }
}
