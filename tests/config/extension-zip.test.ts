import { crc32 } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { createZip } from '../../scripts/zip.mjs'

const enc = new TextEncoder()
const dec = new TextDecoder()

/** Najmenší čitateľ ZIPu: prejde centrálny adresár a vráti súbory (len metóda „store“). */
function readZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = bytes.length - 22
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--
  expect(eocd).toBeGreaterThanOrEqual(0)
  const count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  const files: { name: string; data: Uint8Array; crc: number }[] = []
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(offset, true)).toBe(0x02014b50)
    const method = view.getUint16(offset + 10, true)
    const crc = view.getUint32(offset + 16, true)
    const size = view.getUint32(offset + 24, true)
    const nameLen = view.getUint16(offset + 28, true)
    const extraLen = view.getUint16(offset + 30, true)
    const commentLen = view.getUint16(offset + 32, true)
    const local = view.getUint32(offset + 42, true)
    const name = dec.decode(bytes.subarray(offset + 46, offset + 46 + nameLen))
    expect(method).toBe(0)
    expect(view.getUint32(local, true)).toBe(0x04034b50)
    const localName = view.getUint16(local + 26, true)
    const localExtra = view.getUint16(local + 28, true)
    const start = local + 30 + localName + localExtra
    files.push({ name, data: bytes.subarray(start, start + size), crc })
    offset += 46 + nameLen + extraLen + commentLen
  }
  return files
}

describe('createZip', () => {
  it('vytvorí platný ZIP s názvami, obsahom a kontrolnými súčtami', () => {
    const zip = createZip([
      { name: 'manifest.json', data: enc.encode('{"a":1}') },
      { name: 'icons/icon-16.png', data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255]) },
      { name: 'options.html', data: enc.encode('<p>Kuchárska kniha – nastavenia</p>') },
    ])
    const files = readZip(zip)
    expect(files.map((f) => f.name)).toEqual(['manifest.json', 'icons/icon-16.png', 'options.html'])
    expect(dec.decode(files[0]!.data)).toBe('{"a":1}')
    expect(dec.decode(files[2]!.data)).toBe('<p>Kuchárska kniha – nastavenia</p>')
    for (const f of files) expect(f.crc).toBe(crc32(f.data))
  })

  it('prázdny zoznam dá platný prázdny ZIP', () => {
    expect(readZip(createZip([]))).toEqual([])
  })

  it('začína podpisom ZIPu (PK)', () => {
    const zip = createZip([{ name: 'a.txt', data: enc.encode('a') }])
    expect([...zip.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
  })
})
