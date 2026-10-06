import { describe, expect, it } from 'vitest'

/**
 * Stráži, aby v klientskom kóde nezostal pevne zapísaný slovenský text: všetky texty idú cez i18n
 * (`src/locales`). Hľadá slovenskú diakritiku mimo komentárov. Riadok s `i18n-ignore` sa preskočí
 * (len pre údaje, ktoré nie sú textom aplikácie).
 */
const DIACRITICS = /[áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/

const sources = import.meta.glob<string>(
  [
    '/src/**/*.vue',
    '/src/**/*.ts',
    '!/src/locales/**',
    '!/src/design/**',
    '!/src/styles/**',
    '!/src/i18n/validation.ts',
    '!/src/i18n/defaults.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
)

/** Odstráni komentáre (HTML, blokové, riadkové) a zachová počet riadkov. */
function stripComments(source: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ')
  return source
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .split('\n')
    .map((line) => line.replace(/(^|[\s;,{(])\/\/.*$/, '$1'))
    .join('\n')
}

export function findHardcodedText(source: string): { line: number; text: string }[] {
  const original = source.split('\n')
  return stripComments(source)
    .split('\n')
    .flatMap((text, i) =>
      DIACRITICS.test(text) && !original[i]!.includes('i18n-ignore')
        ? [{ line: i + 1, text: text.trim() }]
        : [],
    )
}

describe('find hardcoded text (kontrola samotná)', () => {
  it('ignoruje komentáre, hlási text v šablóne, atribúte aj reťazci', () => {
    const src = [
      '<!-- komentár s diakritikou ľščťžýáíé -->',
      '<template>',
      '  <v-btn>Uložiť</v-btn>',
      '  <v-text-field label="Názov" />',
      '</template>',
      '<script setup lang="ts">',
      '// komentár: čokoľvek',
      "const a = 'Zmazať'",
      "const b = 'ok' // poznámka: ľahké",
      "const c = 'Výnimka' // i18n-ignore",
      '/* blokový ľ */',
      '</script>',
    ].join('\n')
    expect(findHardcodedText(src).map((f) => f.text)).toEqual([
      '<v-btn>Uložiť</v-btn>',
      '<v-text-field label="Názov" />',
      "const a = 'Zmazať'",
    ])
  })
})

describe('klientský kód bez pevne zapísaných slovenských textov', () => {
  it('všetky texty sú v src/locales', () => {
    const offenders = Object.entries(sources).flatMap(([file, source]) =>
      findHardcodedText(source).map((f) => `${file.slice(1)}:${f.line}: ${f.text.slice(0, 90)}`),
    )
    const report = offenders.join(String.fromCharCode(10))
    expect(
      offenders,
      offenders.length + ' riadkov s pevným textom:' + String.fromCharCode(10) + report,
    ).toEqual([])
  })
})
