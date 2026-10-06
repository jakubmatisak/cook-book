import { crc32 } from 'node:zlib'

const encoder = new TextEncoder()

/**
 * Najmenší zapisovač ZIPu: súbory sa ukladajú bez kompresie (metóda „store“), čo stačí na pár malých súborov
 * rozšírenia a nepotrebuje žiadnu knižnicu. Názvy sú v UTF-8, čas je pevný (výstup je vždy rovnaký).
 * @param {{ name: string; data: Uint8Array }[]} entries
 * @returns {Uint8Array}
 */
export function createZip(entries) {
  const chunks = []
  const central = []
  let offset = 0

  for (const { name, data } of entries) {
    const nameBytes = encoder.encode(name)
    const crc = crc32(data)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true) // verzia potrebná na rozbalenie
    local.setUint16(6, 0x0800, true) // názvy v UTF-8
    local.setUint16(8, 0, true) // metóda: store
    local.setUint16(10, 0, true) // čas
    local.setUint16(12, 0x21, true) // dátum 1. 1. 1980
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, nameBytes.length, true)
    local.setUint16(28, 0, true)
    chunks.push(new Uint8Array(local.buffer), nameBytes, data)

    const entry = new DataView(new ArrayBuffer(46))
    entry.setUint32(0, 0x02014b50, true)
    entry.setUint16(4, 20, true)
    entry.setUint16(6, 20, true)
    entry.setUint16(8, 0x0800, true)
    entry.setUint16(10, 0, true)
    entry.setUint16(12, 0, true)
    entry.setUint16(14, 0x21, true)
    entry.setUint32(16, crc, true)
    entry.setUint32(20, data.length, true)
    entry.setUint32(24, data.length, true)
    entry.setUint16(28, nameBytes.length, true)
    entry.setUint32(42, offset, true)
    central.push(new Uint8Array(entry.buffer), nameBytes)

    offset += 30 + nameBytes.length + data.length
  }

  const centralSize = central.reduce((total, part) => total + part.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)

  const parts = [...chunks, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let position = 0
  for (const part of parts) {
    out.set(part, position)
    position += part.length
  }
  return out
}
