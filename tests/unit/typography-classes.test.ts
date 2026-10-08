import { describe, expect, it } from 'vitest'

/**
 * Vuetify 4 má typografiu Material Design 3 (text-display-*, text-headline-*, text-title-*, text-body-*,
 * text-label-*). Staré triedy z Vuetify 3 v CSS neexistujú a text s nimi by sa ticho zobrazil v predvolenej
 * veľkosti. Hľadá ich mimo komentárov.
 */
const OLD_CLASSES = /\btext-(h[1-6]|subtitle-[12]|body-[12]|caption|overline|button)\b/

const sources = import.meta.glob<string>(['/src/**/*.vue', '/src/**/*.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

describe('typografia Vuetify 4', () => {
  it('v kóde nie sú staré triedy z Vuetify 3', () => {
    const found = Object.entries(sources).flatMap(([file, source]) =>
      stripComments(source)
        .split('\n')
        .filter((line) => OLD_CLASSES.test(line))
        .map((line) => `${file}: ${line.trim()}`),
    )
    expect(found).toEqual([])
  })
})
