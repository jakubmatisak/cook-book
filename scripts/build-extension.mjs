// Zabalí priečinok `extension/` do `public/rozsirenie-kucharska-kniha.zip`, aby si ho používateľ mohol stiahnuť
// priamo z Nastavení aplikácie. Spúšťa sa pred `dev` aj `build` (pozri `package.json`).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createZip } from './zip.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'extension')
const target = join(root, 'public', 'rozsirenie-kucharska-kniha.zip')

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    // d.ts súbory sú len pre testy, do rozšírenia nepatria
    else if (!entry.name.endsWith('.d.ts')) yield path
  }
}

const entries = [...walk(source)].map((path) => ({
  name: relative(source, path).split('\\').join('/'),
  data: new Uint8Array(readFileSync(path)),
}))
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, createZip(entries))
console.log(`Rozšírenie: ${entries.length} súborov → ${relative(root, target)}`)
