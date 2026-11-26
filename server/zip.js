import { deflateRawSync, inflateRawSync } from 'node:zlib'
// ---------- Minimal spec-compliant ZIP writer (CRC32 + DEFLATE) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

export function buildZip(entries) {
  const localParts = [], centralParts = []
  let offset = 0
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8')
    const deflated = deflateRawSync(raw)
    const useDeflate = deflated.length < raw.length
    const body = useDeflate ? deflated : raw
    const method = useDeflate ? 8 : 0
    const crc = crc32(raw)

    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)
    lh.writeUInt16LE(0x0800, 6) // UTF-8 filename flag
    lh.writeUInt16LE(method, 8)
    lh.writeUInt16LE(0, 10)
    lh.writeUInt16LE(0, 12)
    lh.writeUInt32LE(crc, 14)
    lh.writeUInt32LE(body.length, 18)
    lh.writeUInt32LE(raw.length, 22)
    lh.writeUInt16LE(nameBuf.length, 26)
    lh.writeUInt16LE(0, 28)
    localParts.push(lh, nameBuf, body)

    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0)
    ch.writeUInt16LE(20, 4)
    ch.writeUInt16LE(20, 6)
    ch.writeUInt16LE(0x0800, 8)
    ch.writeUInt16LE(method, 10)
    ch.writeUInt16LE(0, 12)
    ch.writeUInt16LE(0, 14)
    ch.writeUInt32LE(crc, 16)
    ch.writeUInt32LE(body.length, 20)
    ch.writeUInt32LE(raw.length, 24)
    ch.writeUInt16LE(nameBuf.length, 28)
    ch.writeUInt16LE(0, 30)
    ch.writeUInt16LE(0, 32)
    ch.writeUInt16LE(0, 34)
    ch.writeUInt16LE(0, 36)
    ch.writeUInt32LE(0, 38)
    ch.writeUInt32LE(offset, 42)
    centralParts.push(ch, nameBuf)

    offset += lh.length + nameBuf.length + body.length
  }

  const centralBuf = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...localParts, centralBuf, eocd])
}

// Single-disk ZIP32 only. Validate the directory and the actual decompressor output.
export function readZip(buf, { maxEntries = 512, maxBytes = 32 * 1024 * 1024 } = {}) {
  const fail = () => { throw new Error('Invalid ZIP or archive limit exceeded') }
  if (!Buffer.isBuffer(buf) || buf.length > 64 * 1024 * 1024) fail()
  let end = buf.length - 22
  while (end >= Math.max(0, buf.length - 65557) && (buf.readUInt32LE(end) !== 0x06054b50 || end + 22 + buf.readUInt16LE(end+20) !== buf.length)) end--
  if (end < 0 || buf.readUInt32LE(end) !== 0x06054b50 || buf.readUInt32LE(end+4)) fail()
  const count = buf.readUInt16LE(end+10), start = buf.readUInt32LE(end+16)
  if (count !== buf.readUInt16LE(end+8) || count > maxEntries || start + buf.readUInt32LE(end+12) !== end) fail()
  const out = new Map(); let pos = start, total = 0
  for (let i=0; i<count; i++) {
    if (pos+46 > end || buf.readUInt32LE(pos) !== 0x02014b50) fail()
    const flags=buf.readUInt16LE(pos+8), method=buf.readUInt16LE(pos+10), crc=buf.readUInt32LE(pos+16), compressed=buf.readUInt32LE(pos+20), size=buf.readUInt32LE(pos+24), n=buf.readUInt16LE(pos+28), local=buf.readUInt32LE(pos+42)
    const name=buf.toString('utf8',pos+46,pos+46+n)
    pos += 46+n+buf.readUInt16LE(pos+30)+buf.readUInt16LE(pos+32)
    if (!name || name.startsWith('/') || /[:\\\x00]/.test(name) || name.split('/').some(x=>x==='..'||x==='.') || out.has(name) || flags & 1 || ![0,8].includes(method) || (total+=size)>maxBytes || pos>end || local+30>start || buf.readUInt32LE(local)!==0x04034b50) fail()
    const nl=buf.readUInt16LE(local+26), off=local+30+nl+buf.readUInt16LE(local+28)
    if (buf.toString('utf8',local+30,local+30+nl)!==name || buf.readUInt16LE(local+8)!==method || off+compressed>start) fail()
    const data=buf.subarray(off,off+compressed), raw=method===0 ? data : inflateRawSync(data,{maxOutputLength:Math.max(1,size)})
    if (raw.length!==size || crc32(raw)!==crc) fail()
    out.set(name,raw)
  }
  if(pos!==end) fail()
  return out
}
