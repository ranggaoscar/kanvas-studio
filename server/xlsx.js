import { buildZip, readZip } from './zip.js'
import { posix } from 'node:path'
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main', R='http://schemas.openxmlformats.org/officeDocument/2006/relationships', PK='http://schemas.openxmlformats.org/package/2006/relationships'
const esc=s=>String(s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
const dec=s=>s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,(_,v)=>v.startsWith('#')?String.fromCodePoint(v[1]==='x'?parseInt(v.slice(2),16):Number(v.slice(1))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[v])
function col(i){let s=''; for(i++;i;i=Math.floor((i-1)/26)) s=String.fromCharCode(65+(i-1)%26)+s;return s}
const rel=(id,type,path)=>`<Relationship Id="r${id}" Type="${R}/${type}" Target="${path}"/>`
const rels=s=>`<Relationships xmlns="${PK}">${s}</Relationships>`
const xf=(font,fill,num)=>`<xf numFmtId="${num}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/>`
const fills=['none','gray125','FF19283C','FFF1F5F9'].map((v,i)=>`<fill><patternFill patternType="${i<2?v:'solid'}">${i<2?'':`<fgColor rgb="${v}"/><bgColor indexed="64"/>`}</patternFill></fill>`).join('')
const styles=`<styleSheet xmlns="${NS}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4">${fills}</fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="10">${xf(0,0,0)+xf(1,2,0)+[0,3].flatMap(f=>[0,4,10,7].map(n=>xf(0,f,n))).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
export function writeXlsx({sheets}) {
  if(!Array.isArray(sheets)||!sheets.length||sheets.length>32) throw Error('Expected 1–32 sheets')
  const entries=[], strings=new Map(), names=new Set();let count=0,cells=0
  const add=(name,data)=>entries.push({name,data});let manifest='',links='',types=''
  for(const [i,sh] of sheets.entries()){
    let name=String(sh.name||`Sheet ${i+1}`).replace(/[\\/:*?\[\]]/g,' ').slice(0,31);const base=name;for(let n=2;names.has(name.toLowerCase());n++) name=base.slice(0,25)+' '+n;names.add(name.toLowerCase())
    const {headers,rows}=sh;if(!Array.isArray(headers)||!headers.length||headers.length>256||!Array.isArray(rows)||(cells+=(rows.length+1)*headers.length)>250000)throw Error('Invalid sheet dimensions or cell limit exceeded')
    const widths=headers.map(v=>String(v).length+3)
    const lines=[headers,...rows].map((row,y)=>{if(!Array.isArray(row)||row.length>headers.length)throw Error('Invalid row width');return `<row r="${y+1}">`+row.map((v,x)=>{if(v==null)return '';if(!['string','number','boolean'].includes(typeof v)||String(v).length>32767)throw Error('Invalid cell'); widths[x]=Math.max(widths[x],String(v).length+2);const style=y?2+((y-1)%2)*4+({number:1,percent:2,currency:3}[sh.formats?.[x]]||0):1;let t='n',value=v;if(typeof v==='boolean'){t='b';value=Number(v)}else if(typeof v!=='number'){t='s';count++;if(!strings.has(v))strings.set(v,strings.size);value=strings.get(v)}else if(!Number.isFinite(v))throw Error('Invalid number');return `<c r="${col(x)}${y+1}" s="${style}" t="${t}"><v>${value}</v></c>`}).join('')+'</row>'}).join('')
    const path=`worksheets/sheet${i+1}.xml`;add('xl/'+path,`<worksheet xmlns="${NS}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w,x)=>`<col min="${x+1}" max="${x+1}" width="${Math.min(60,Math.max(8,w))}" customWidth="1"/>`).join('')}</cols><sheetData>${lines}</sheetData></worksheet>`)
    manifest+=`<sheet name="${esc(name)}" sheetId="${i+1}" r:id="r${i+1}"/>`;links+=rel(i+1,'worksheet',path);types+=override('xl/'+path,'worksheet')
  }
  function override(path,type){return `<Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.${type}+xml"/>`}
  add('xl/workbook.xml',`<workbook xmlns="${NS}" xmlns:r="${R}"><sheets>${manifest}</sheets></workbook>`);add('xl/_rels/workbook.xml.rels',rels(links+rel('Style','styles','styles.xml')+rel('Strings','sharedStrings','sharedStrings.xml')));add('_rels/.rels',rels(rel(1,'officeDocument','xl/workbook.xml')));add('xl/styles.xml',styles);add('xl/sharedStrings.xml',`<sst xmlns="${NS}" count="${count}" uniqueCount="${strings.size}">${[...strings.keys()].map(s=>`<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`);add('[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${types+override('xl/workbook.xml','sheet.main')+override('xl/styles.xml','styles')+override('xl/sharedStrings.xml','sharedStrings')}</Types>`);return buildZip(entries)
}
const attr=(s,k)=>dec(s.match(new RegExp(`(?:^|\\s)${k}=["']([^"']*)["']`))?.[1]||'')
const texts=s=>[...s.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>dec(m[1])).join('')
function csv(s,accept){let row=[],cell='',quoted=false;for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(!quoted&&c===','){row.push(cell);cell='';if(row.length>256)throw Error('Too many columns')}else if(!quoted&&/[\r\n]/.test(c)){if(c==='\r'&&s[i+1]==='\n')i++;row.push(cell);accept(row);row=[];cell=''}else cell+=c}if(quoted)throw Error('Unclosed CSV quote');if(cell||row.length)accept([...row,cell])}
export function readTabularFile(buf,{format='xlsx',limit=20}={}){
  if(buf.length>32*1024*1024)throw Error('Input too large');const sheets=[];limit=Math.min(200,Math.max(0,Number(limit)||0))
  function sheet(name){const sh={name,headers:[],rows:[],rowCount:0};sheets.push(sh);let header=false;return row=>{if(row.length>256)throw Error('Too many columns');if(!header){sh.headers=row.map(v=>String(v??''));header=true}else{sh.rowCount++;if(sh.rows.length<limit)sh.rows.push(row)}}}
  if(format==='csv'){csv(buf.toString('utf8').replace(/^\uFEFF/,''),sheet('CSV'));return {sheets}}
  const zip=readZip(buf);function xml(n){if(!zip.has(n))throw Error('Missing workbook part: '+n);const s=zip.get(n).toString('utf8');if(/<!DOCTYPE|<!ENTITY/i.test(s))throw Error('DTD not supported');return s}
  const links=new Map();for(const m of xml('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\s([^>]+)>/g)){if(attr(m[1],'TargetMode')==='External')continue;const t=attr(m[1],'Target');links.set(attr(m[1],'Id'),t.startsWith('/')?t.slice(1):posix.normalize('xl/'+t))}
  const strings=zip.has('xl/sharedStrings.xml')?[...xml('xl/sharedStrings.xml').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>texts(m[1])):[]
  for(const m of xml('xl/workbook.xml').matchAll(/<sheet\s([^>]+)>/g)){if(sheets.length>=32)throw Error('Too many sheets');const accept=sheet(attr(m[1],'name'));for(const r of xml(links.get(attr(m[1],'r:id'))).matchAll(/<row\b[^>]*?(?<!\/)>([\s\S]*?)<\/row>/g)){const row=[];for(const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){const ref=attr(c[1],'r').match(/^[A-Z]+/)?.[0], x=ref?[...ref].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0)-1:row.length;if(x>255)throw Error('Too many columns');const t=attr(c[1],'t'),body=c[2]||'',v=dec(body.match(/<v>([^<]*)<\/v>/)?.[1]||'');row[x]=t==='s'?strings[Number(v)]??'':t==='inlineStr'?texts(body):t==='b'?v==='1':v!==''&&(!t||t==='n')?Number(v):v}accept(row)}}if(!sheets.length)throw Error('No worksheets');return {sheets}
}
export function sheetsFromDoc(doc){const sheets=[];for(const ab of doc.artboards||[]){const els=ab.elemen||[],children=id=>els.filter(e=>e.induk===id);for(const h of els.filter(e=>['Header Row','Table Header'].includes(e.nama))){const group=els.find(e=>e.id===h.induk);sheets.push({name:group?.nama||ab.nama,headers:children(h.id).map(e=>e.teks),rows:children(h.induk).filter(e=>e.nama==='Total Row'||/^Row \d+$/.test(e.nama)).map(r=>children(r.id).map(e=>e.teks))})}}if(!sheets.length)throw Error('No editable table found; supply sheets explicitly');return sheets}

const TIME_HEADER_RE = /\b(bulan|month|tanggal|date|tgl|kuartal|quarter|tahun|year|thn|periode|period|minggu|week|hari|day|semester)\b/i
const TIME_VALUE_RE = /^(?:(?:jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec|januari|februari|maret|april|juni|juli|agustus|september|oktober|november|desember)(?:[\s\-/'’]\d{2,4})?|q[1-4](?:[\s\-/'’]\d{2,4})?|kuartal\s*[1-4](?:\s*\d{2,4})?|(?:19|20)\d{2}|\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|(?:w|wk|week|minggu|p)\s*\d{1,2})$/i
const ID_HEADER_RE = /^(?:no\.?|nomor|num|#|id|kode|code|sku|halaman|page|baris|row|index|idx)$/i
const CURRENCY_HEADER_RE = /(?:^|[\s(_-])(rp|idr|usd|eur|omzet|omset|pendapatan|revenue|sales|penjualan|biaya|cost|budget|anggaran|laba|profit|harga|price|nilai|pengeluaran|pemasukan|gaji|saldo|margin\s*rp)(?:$|[\s)_.-])/i
const PERCENT_HEADER_RE = /(%|persen|persentase|percent|share|porsi|proporsi|komposisi|kontribusi|rasio|ratio|margin|growth|pertumbuhan|varians|variance|capaian|achievement|rate|ctr|roi|mix|alokasi|allocation|distribusi|bobot)/i
const PROPORTION_HEADER_RE = /(porsi|share|proporsi|komposisi|kontribusi|mix|alokasi|allocation|distribusi|bobot|persentase|persen|%)/i
const TARGET_HEADER_RE = /(target|budget|anggaran|rencana|plan|forecast|kuota|quota|baseline|pagu)/i
const ACTUAL_HEADER_RE = /(aktual|actual|realisasi|realized|tercapai|omzet|omset|penjualan|pendapatan|revenue|sales|hasil|pengeluaran|spend|output)/i
const VARIANCE_HEADER_RE = /(varians|variance|selisih|diff|delta|growth|pertumbuhan|yoy|mom|qoq|change|deviasi|kenaikan|penurunan)/i
const SUMMARY_ROW_RE = /^(?:grand\s+total|total|jumlah|subtotal|sub\s*total|rata[\s-]*rata|average|mean|keseluruhan)\b/i

export function parseTabularNumber(raw, formatHint = '') {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null
    const kind = formatHint === 'percent' ? 'percent' : formatHint === 'currency' ? 'currency' : 'number'
    return { value: raw, kind, currency: kind === 'currency' ? 'Rp' : '', hasExplicitPercent: false }
  }
  const s = String(raw ?? '').trim()
  if (!s || /^[-–—]+$/.test(s)) return null
  if (TIME_VALUE_RE.test(s) && !/^(19|20)\d{2}$/.test(s)) return null
  let work = s
  let neg = false
  if (/^\(.*\)$/.test(work)) { neg = true; work = work.slice(1, -1).trim() }
  if (work.startsWith('-')) { neg = true; work = work.slice(1).trim() }
  else if (work.startsWith('+')) { work = work.slice(1).trim() }

  let currency = ''
  const curMatch = work.match(/^(Rp\.?|IDR|USD|\$|€|EUR)\s*/i)
  if (curMatch) {
    const token = curMatch[1].toUpperCase()
    currency = token.startsWith('RP') || token === 'IDR' ? 'Rp' : token === 'EUR' || token === '€' ? '€' : '$'
    work = work.slice(curMatch[0].length).trim()
  }
  let hasExplicitPercent = false
  if (work.endsWith('%')) { hasExplicitPercent = true; work = work.slice(0, -1).trim() }

  let mult = 1
  const unitMatch = work.match(/\s*(miliar|milyar|billion|bn|m|juta|jt|ribu|rb|k)$/i)
  if (unitMatch) {
    const u = unitMatch[1].toLowerCase()
    if (u === 'miliar' || u === 'milyar' || u === 'billion' || u === 'bn') mult = 1e9
    else if (u === 'm') mult = currency === 'Rp' ? 1e9 : 1e6
    else if (u === 'juta' || u === 'jt') mult = 1e6
    else if (u === 'ribu' || u === 'rb' || u === 'k') mult = 1e3
    work = work.slice(0, -unitMatch[0].length).trim()
  }

  if (!/^[\d.,\s]+$/.test(work) || !/\d/.test(work)) return null
  work = work.replace(/\s+/g, '')
  const dots = (work.match(/\./g) || []).length
  const commas = (work.match(/,/g) || []).length
  let norm = work
  if (dots && commas) {
    // Whichever separator appears last is decimal; the other is thousands
    norm = work.lastIndexOf(',') > work.lastIndexOf('.')
      ? work.replace(/\./g, '').replace(',', '.')
      : work.replace(/,/g, '')
  } else if (dots > 1) {
    norm = work.replace(/\./g, '')
  } else if (commas > 1) {
    norm = work.replace(/,/g, '')
  } else if (dots === 1) {
    const parts = work.split('.')
    norm = parts[1].length === 3 && (currency === 'Rp' || parts[0].length >= 1 && Number(parts[0]) >= 1)
      ? parts.join('')
      : work
  } else if (commas === 1) {
    const parts = work.split(',')
    norm = parts[1].length === 3 && currency !== 'Rp' ? parts.join('') : parts.join('.')
  }
  const n = Number(norm)
  if (!Number.isFinite(n)) return null
  const value = (neg ? -n : n) * mult
  const kind = hasExplicitPercent || formatHint === 'percent' ? 'percent'
    : currency || formatHint === 'currency' ? 'currency' : 'number'
  return { value, kind, currency: currency || (kind === 'currency' ? 'Rp' : ''), hasExplicitPercent }
}

function roundSmart(n, decimals = 1) {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

export function formatMetricValue(value, { kind = 'number', currency = '', signed = false } = {}) {
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value ?? '')
  const sign = signed && n > 0 ? '+' : n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (kind === 'percent') {
    const v = Number.isInteger(roundSmart(abs, 1)) ? String(Math.round(abs)) : roundSmart(abs, 1).toFixed(1)
    return `${sign}${v}%`
  }
  if (kind === 'currency') {
    const sym = currency || 'Rp'
    if (sym === 'Rp') {
      if (abs >= 1e9) return `${sign}Rp ${roundSmart(abs / 1e9, 2).toLocaleString('id-ID')} M`
      if (abs >= 1e6) return `${sign}Rp ${roundSmart(abs / 1e6, 1).toLocaleString('id-ID')} jt`
      if (abs >= 1e3) return `${sign}Rp ${Math.round(abs).toLocaleString('id-ID')}`
      return `${sign}Rp ${roundSmart(abs, 0)}`
    }
    if (abs >= 1e9) return `${sign}${sym}${roundSmart(abs / 1e9, 2)}B`
    if (abs >= 1e6) return `${sign}${sym}${roundSmart(abs / 1e6, 2)}M`
    if (abs >= 1e3) return `${sign}${sym}${roundSmart(abs / 1e3, 1)}K`
    return `${sign}${sym}${roundSmart(abs, 2)}`
  }
  if (abs >= 1e6) return `${sign}${roundSmart(abs / 1e6, 2)}M`
  if (abs >= 1e4) return `${sign}${Math.round(abs).toLocaleString('en-US')}`
  return `${sign}${Number.isInteger(abs) ? abs.toLocaleString('en-US') : roundSmart(abs, 2)}`
}

function compactChartScale(values, metric) {
  if (metric.kind === 'percent') return { divisor: 1, unit: '%', scaleNote: '' }
  const maxAbs = Math.max(0, ...values.map(v => Math.abs(Number(v) || 0)))
  if (metric.kind === 'currency' && (metric.currency === 'Rp' || !metric.currency)) {
    if (maxAbs >= 1e9) return { divisor: 1e9, unit: ' M', scaleNote: 'dalam Miliar Rp' }
    if (maxAbs >= 1e6) return { divisor: 1e6, unit: ' jt', scaleNote: 'dalam Juta Rp' }
    if (maxAbs >= 1e4) return { divisor: 1e3, unit: ' rb', scaleNote: 'dalam Ribu Rp' }
    return { divisor: 1, unit: '', scaleNote: 'dalam Rp' }
  }
  if (metric.kind === 'currency') {
    if (maxAbs >= 1e6) return { divisor: 1e6, unit: 'M', scaleNote: `in ${metric.currency} Millions` }
    if (maxAbs >= 1e4) return { divisor: 1e3, unit: 'K', scaleNote: `in ${metric.currency} Thousands` }
    return { divisor: 1, unit: '', scaleNote: `in ${metric.currency}` }
  }
  if (maxAbs >= 1e6) return { divisor: 1e6, unit: 'M', scaleNote: 'dalam jutaan' }
  if (maxAbs >= 1e4) return { divisor: 1e3, unit: 'K', scaleNote: 'dalam ribuan' }
  return { divisor: 1, unit: '', scaleNote: '' }
}

export function analyzeTabularData(sheet = {}) {
  const headers = Array.isArray(sheet.headers) ? sheet.headers.map(h => String(h ?? '').trim())
    : Array.isArray(sheet.columns) ? sheet.columns.map(h => String(h ?? '').trim()) : []
  const rawRows = Array.isArray(sheet.rows) ? sheet.rows : []
  const formats = Array.isArray(sheet.formats) ? sheet.formats : []
  const sheetName = String(sheet.name || sheet.heading || 'Data').trim()

  if (!headers.length || !rawRows.length) {
    return { name: sheetName, headers, dataRows: [], dimension: null, metrics: [], primaryMetric: null, targetMetric: null, varianceMetric: null, numericColIndices: [], kpis: [], insights: [], chart: null, summaryRow: null, headline: sheetName }
  }

  // Separate explicit summary/total rows from analytical rows so averages/charts aren't skewed
  const dataRows = []
  let sourceSummaryRow = null
  for (const r of rawRows) {
    const arr = Array.isArray(r) ? r : headers.map(h => r?.[h] ?? '')
    const firstText = String(arr[0] ?? '').trim()
    if (SUMMARY_ROW_RE.test(firstText) && dataRows.length > 0) {
      sourceSummaryRow = arr
    } else if (arr.some(c => String(c ?? '').trim() !== '')) {
      dataRows.push(arr)
    }
  }
  const rows = dataRows.length ? dataRows : rawRows

  // Profile each column
  const colProfiles = headers.map((header, idx) => {
    const hint = formats[idx] || ''
    const vals = rows.map(r => r[idx])
    const nonEmpty = vals.filter(v => v != null && String(v).trim() !== '')
    const parsed = vals.map(v => parseTabularNumber(v, hint))
    const validParsed = parsed.filter(Boolean)
    const numericRatio = nonEmpty.length ? validParsed.length / nonEmpty.length : 0
    const timeValMatches = nonEmpty.filter(v => TIME_VALUE_RE.test(String(v).trim())).length
    const timeRatio = nonEmpty.length ? timeValMatches / nonEmpty.length : 0
    const pureYearCol = nonEmpty.length >= 2 && nonEmpty.every(v => /^(19|20)\d{2}$/.test(String(v).trim()))
    const isId = ID_HEADER_RE.test(header)
    const isTimeHeader = TIME_HEADER_RE.test(header)
    const isTime = isTimeHeader || timeRatio >= 0.6 || pureYearCol

    let kind = 'text', currency = '', role = 'category'
    if (isTime) {
      kind = 'time'; role = 'dimension'
    } else if (!isId && numericRatio >= 0.7 && validParsed.length >= 1) {
      const hasCurCell = validParsed.some(p => p.currency)
      const hasPctCell = validParsed.some(p => p.hasExplicitPercent)
      const isCur = hint === 'currency' || hasCurCell || CURRENCY_HEADER_RE.test(header)
      const isPct = !isCur && (hint === 'percent' || hasPctCell || PERCENT_HEADER_RE.test(header))
      kind = isCur ? 'currency' : isPct ? 'percent' : 'number'
      currency = validParsed.find(p => p.currency)?.currency || (isCur ? (/\b(usd|\$)\b/i.test(header) ? '$' : /\b(eur|€)\b/i.test(header) ? '€' : 'Rp') : '')

      // Detect Excel fractional percentages (e.g. 0.25 with percent format or % header, no explicit % string)
      const isFraction = kind === 'percent' && !hasPctCell && validParsed.every(p => Math.abs(p.value) <= 1.0001) && validParsed.some(p => Math.abs(p.value) > 0 && Math.abs(p.value) < 1)
      const values = parsed.map(p => p ? (isFraction ? p.value * 100 : p.value) : null)

      if (VARIANCE_HEADER_RE.test(header)) role = 'variance'
      else if (TARGET_HEADER_RE.test(header)) role = 'target'
      else if (PROPORTION_HEADER_RE.test(header) && !ACTUAL_HEADER_RE.test(header)) role = 'proportion'
      else if (ACTUAL_HEADER_RE.test(header)) role = 'actual'
      else role = 'count'

      return { index: idx, header, kind, currency, role, isNumeric: true, values }
    } else if (isId) {
      kind = 'id'; role = 'id'
    }
    return { index: idx, header, kind, currency, role, isNumeric: false, values: vals.map(v => String(v ?? '').trim()) }
  })

  // Choose dimension column (prefer time column, else first text/category column)
  const dimension = colProfiles.find(c => c.kind === 'time')
    || colProfiles.find(c => !c.isNumeric && c.role !== 'id')
    || colProfiles[0]

  const metrics = colProfiles.filter(c => c.isNumeric && c.index !== dimension?.index)
  const numericColIndices = colProfiles.filter(c => c.isNumeric).map(c => c.index)
  if (!dimension || !metrics.length) {
    return { name: sheetName, headers, dataRows: rows, dimension, metrics: [], primaryMetric: null, targetMetric: null, varianceMetric: null, numericColIndices, kpis: [], insights: [], chart: null, summaryRow: sourceSummaryRow, headline: sheetName }
  }

  const targetMetric = metrics.find(m => m.role === 'target') || null
  const varianceMetric = metrics.find(m => m.role === 'variance') || null
  const primaryMetric = metrics.find(m => m.role === 'actual')
    || metrics.find(m => m.role === 'proportion')
    || metrics.find(m => m.kind === 'currency' && m !== targetMetric && m !== varianceMetric)
    || metrics.find(m => m !== targetMetric && m !== varianceMetric)
    || metrics[0]
  if (targetMetric && targetMetric.kind === 'number' && primaryMetric?.kind === 'currency') {
    targetMetric.kind = 'currency'
    targetMetric.currency = primaryMetric.currency || 'Rp'
  }

  const pairs = rows.map((r, ri) => ({
    label: String(r[dimension.index] ?? `Item ${ri + 1}`).trim() || `Item ${ri + 1}`,
    value: primaryMetric.values[ri],
    target: targetMetric ? targetMetric.values[ri] : null,
    variance: varianceMetric ? varianceMetric.values[ri] : null,
    rowIndex: ri
  })).filter(p => Number.isFinite(p.value))

  if (!pairs.length) {
    return { name: sheetName, headers, dataRows: rows, dimension, metrics, primaryMetric, targetMetric, varianceMetric, numericColIndices, kpis: [], insights: [], chart: null, summaryRow: sourceSummaryRow, headline: sheetName }
  }

  const vals = pairs.map(p => p.value)
  const total = vals.reduce((s, v) => s + v, 0)
  const average = total / vals.length
  let top = pairs[0], bottom = pairs[0]
  for (const p of pairs) {
    if (p.value > top.value) top = p
    if (p.value < bottom.value) bottom = p
  }

  // Growth / Variance calculation
  let growthPct = null, growthLabel = '', growthDetail = ''
  if (targetMetric) {
    const targetVals = pairs.map(p => p.target).filter(Number.isFinite)
    const totalTarget = targetVals.reduce((s, v) => s + v, 0)
    if (Math.abs(totalTarget) > 1e-9) {
      growthPct = ((total - totalTarget) / Math.abs(totalTarget)) * 100
      growthLabel = 'Varians vs Target'
      growthDetail = `Target ${formatMetricValue(totalTarget, targetMetric)}`
    }
  } else if (dimension.kind === 'time' && pairs.length >= 2 && Math.abs(pairs[0].value) > 1e-9) {
    growthPct = ((pairs.at(-1).value - pairs[0].value) / Math.abs(pairs[0].value)) * 100
    growthLabel = 'Pertumbuhan'
    growthDetail = `${pairs[0].label} → ${pairs.at(-1).label}`
  } else if (varianceMetric) {
    const vList = pairs.map(p => p.variance).filter(Number.isFinite)
    if (vList.length) {
      growthPct = vList.reduce((s, v) => s + v, 0) / vList.length
      growthLabel = varianceMetric.header || 'Rata-rata Varians'
      growthDetail = `Rentang ${formatMetricValue(Math.min(...vList), { kind: 'percent', signed: true })} s.d. ${formatMetricValue(Math.max(...vList), { kind: 'percent', signed: true })}`
    }
  }

  const isSum100 = pairs.length >= 2 && pairs.length <= 6 && pairs.every(p => p.value > 0) && total >= 96 && total <= 104
  const isProportion = pairs.length >= 2 && pairs.length <= 6 && pairs.every(p => p.value >= 0) && pairs.some(p => p.value > 0) && (
    primaryMetric.role === 'proportion' || (primaryMetric.kind === 'percent' && dimension.kind !== 'time' && isSum100) || (dimension.kind !== 'time' && primaryMetric.kind === 'percent' && pairs.length <= 6)
  )

  const fmtPrimary = v => formatMetricValue(v, primaryMetric)
  const shareOfTotal = Math.abs(total) > 1e-9 ? roundSmart((top.value / Math.abs(total)) * 100, 1) : 0

  // KPI Summary cards (3–4 high-signal KPIs)
  const kpis = [
    {
      label: isProportion ? `Total ${primaryMetric.header}` : `Total ${primaryMetric.header}`,
      value: isProportion && isSum100 ? '100%' : fmtPrimary(total),
      detail: `${pairs.length} ${dimension.header.toLowerCase()}`,
      tone: 'accent'
    },
    {
      label: 'Top Performer',
      value: fmtPrimary(top.value),
      detail: `${top.label} (${shareOfTotal}%)`,
      tone: 'neutral'
    },
    growthPct != null
      ? {
          label: growthLabel,
          value: formatMetricValue(growthPct, { kind: 'percent', signed: true }),
          detail: growthDetail,
          tone: growthPct >= 0 ? 'positive' : 'negative'
        }
      : {
          label: `Rata-rata`,
          value: fmtPrimary(average),
          detail: `Terendah: ${bottom.label}`,
          tone: 'neutral'
        }
  ]

  // Build native editable chart spec for server/dataviz.js
  let chart = null
  if (pairs.length >= 2) {
    const scale = compactChartScale(vals, primaryMetric)
    const scaleVal = v => roundSmart(v / scale.divisor, scale.divisor > 1 ? 1 : (Number.isInteger(v) ? 0 : 1))
    const subtitleParts = [primaryMetric.header, scale.scaleNote].filter(Boolean)

    if (dimension.kind === 'time') {
      const labels = pairs.map(p => p.label)
      const peakIdx = pairs.reduce((bi, p, i) => (p.value > pairs[bi].value ? i : bi), 0)
      if (targetMetric && pairs.every(p => Number.isFinite(p.target))) {
        const targetVals = pairs.map(p => scaleVal(p.target))
        chart = {
          type: 'line',
          title: `Tren ${primaryMetric.header} vs ${targetMetric.header}`,
          subtitle: subtitleParts.join(' · '),
          labels,
          series: [
            { name: primaryMetric.header, values: pairs.map(p => scaleVal(p.value)) },
            { name: targetMetric.header, values: targetVals }
          ],
          unit: scale.unit,
          showArea: true,
          highlightIndex: pairs.length - 1
        }
      } else if (pairs.length >= 7) {
        chart = {
          type: 'line',
          title: `Tren ${primaryMetric.header}`,
          subtitle: subtitleParts.join(' · '),
          labels,
          series: [{ name: primaryMetric.header, values: pairs.map(p => scaleVal(p.value)) }],
          unit: scale.unit,
          showArea: true,
          highlightIndex: peakIdx
        }
      } else {
        const hiIdx = pairs.at(-1).value >= pairs[0].value ? pairs.length - 1 : peakIdx
        chart = {
          type: 'bar',
          title: `Tren ${primaryMetric.header}`,
          subtitle: subtitleParts.join(' · '),
          data: pairs.map(p => ({ label: p.label, value: scaleVal(p.value) })),
          unit: scale.unit,
          highlightIndex: hiIdx
        }
      }
    } else if (isProportion) {
      const sorted = [...pairs].sort((a, b) => b.value - a.value)
      chart = {
        type: 'donut',
        title: `Komposisi ${primaryMetric.header}`,
        subtitle: `Distribusi per ${dimension.header.toLowerCase()}`,
        data: sorted.map(p => ({ label: p.label, value: scaleVal(p.value) })),
        unit: scale.unit || '%',
        centerLabel: isSum100 ? 'TOTAL' : 'TERTINGGI',
        centerValue: isSum100 ? '100%' : fmtPrimary(sorted[0].value)
      }
    } else {
      const sorted = [...pairs].sort((a, b) => b.value - a.value)
      const topItems = sorted.length > 8
        ? [...sorted.slice(0, 7), { label: 'Lainnya', value: sorted.slice(7).reduce((s, x) => s + x.value, 0) }]
        : sorted
      const chartType = topItems.length >= 4 || topItems.some(d => d.label.length > 9) ? 'hbar' : 'bar'
      chart = {
        type: chartType,
        title: `Perbandingan ${primaryMetric.header}`,
        subtitle: `${subtitleParts.join(' · ')} · diurutkan tertinggi`,
        data: topItems.map(p => ({ label: p.label, value: scaleVal(p.value) })),
        unit: scale.unit,
        highlightIndex: 0
      }
    }
  }

  // Auto-generated editorial insight cards (2–3 cards for Split Visual Insight layout)
  const insights = [
    {
      tag: 'TOP PERFORMER',
      title: top.label,
      value: fmtPrimary(top.value),
      detail: `Menyumbang ${shareOfTotal}% dari total ${primaryMetric.header.toLowerCase()}.`,
      tone: 'accent'
    }
  ]
  if (growthPct != null) {
    const isTimeTrend = !targetMetric && dimension.kind === 'time'
    insights.push({
      tag: targetMetric ? 'CAPAIAN TARGET' : isTimeTrend ? 'RINGKASAN TREN' : 'RATA-RATA VARIANS',
      title: formatMetricValue(growthPct, { kind: 'percent', signed: true }),
      value: growthDetail,
      detail: targetMetric
        ? (growthPct >= 0 ? 'Realisasi total melampaui target periode.' : 'Realisasi total masih di bawah target periode.')
        : isTimeTrend
          ? (growthPct >= 0 ? `Tren meningkat dari ${pairs[0].label} ke ${pairs.at(-1).label}.` : `Tren menurun dari ${pairs[0].label} ke ${pairs.at(-1).label}.`)
          : (growthPct >= 0 ? `Rata-rata varians positif pada ${pairs.length} ${dimension.header.toLowerCase()}.` : `Rata-rata varians negatif pada ${pairs.length} ${dimension.header.toLowerCase()}.`),
      tone: growthPct >= 0 ? 'positive' : 'negative'
    })
  } else {
    insights.push({
      tag: 'RATA-RATA',
      title: fmtPrimary(average),
      value: `${pairs.length} ${dimension.header.toLowerCase()}`,
      detail: `Rentang nilai antara ${fmtPrimary(bottom.value)} hingga ${fmtPrimary(top.value)}.`,
      tone: 'neutral'
    })
  }
  if (pairs.length >= 2 && bottom.label !== top.label) {
    const gapPct = Math.abs(average) > 1e-9 ? roundSmart(((bottom.value - average) / Math.abs(average)) * 100, 1) : 0
    insights.push({
      tag: 'PERLU PERHATIAN',
      title: bottom.label,
      value: fmtPrimary(bottom.value),
      detail: `Posisi terendah (${formatMetricValue(gapPct, { kind: 'percent', signed: true })} vs rata-rata).`,
      tone: 'negative'
    })
  }

  // Conclusion-first editorial headline
  let headline = sheetName
  if (dimension.kind === 'time' && growthPct != null) {
    headline = `${primaryMetric.header} ${growthPct >= 0 ? 'tumbuh' : 'turun'} ${formatMetricValue(growthPct, { kind: 'percent', signed: true })} — puncak di ${top.label}`
  } else if (isProportion) {
    headline = `${top.label} mendominasi ${shareOfTotal}% komposisi ${primaryMetric.header}`
  } else {
    headline = `${top.label} memimpin ${primaryMetric.header} sebesar ${fmtPrimary(top.value)}`
  }

  // Auto-computed prominent summary row for data tables
  const summaryRow = sourceSummaryRow || headers.map((h, ci) => {
    if (ci === dimension.index) return 'Total'
    const col = colProfiles[ci]
    if (!col?.isNumeric) return ''
    const colVals = col.values.filter(Number.isFinite)
    if (!colVals.length) return ''
    if (col.role === 'variance') {
      const avgV = colVals.reduce((s, v) => s + v, 0) / colVals.length
      return formatMetricValue(avgV, { kind: col.kind === 'percent' ? 'percent' : col.kind, currency: col.currency, signed: true })
    }
    const sumV = colVals.reduce((s, v) => s + v, 0)
    if (col.kind === 'percent' && !(sumV >= 96 && sumV <= 104)) {
      return formatMetricValue(sumV / colVals.length, col)
    }
    return formatMetricValue(sumV, col)
  })

  return {
    name: sheetName,
    headers,
    dataRows: rows,
    dimension,
    metrics,
    primaryMetric,
    targetMetric,
    varianceMetric,
    numericColIndices,
    stats: { total, average, top, bottom, growthPct, count: pairs.length },
    kpis,
    insights,
    chart,
    summaryRow,
    headline
  }
}
