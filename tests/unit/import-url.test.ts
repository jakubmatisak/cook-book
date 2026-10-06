import { describe, expect, it } from 'vitest'
import { buildImportUrl } from '../../extension/buildImportUrl.js'
import { importTargetFromQuery, normalizeUrl } from '@/features/recipes/importUrl'

describe('normalizeUrl', () => {
  it('doplní https:// k adrese skopírovanej z lišty', () => {
    expect(normalizeUrl('www.example.sk/recept')).toBe('https://www.example.sk/recept')
  })

  it('už úplnú adresu nemení', () => {
    expect(normalizeUrl('http://example.sk/r')).toBe('http://example.sk/r')
    expect(normalizeUrl('HTTPS://example.sk/r')).toBe('HTTPS://example.sk/r')
  })
})

describe('importTargetFromQuery', () => {
  it('berie prvú hodnotu parametra a oreže medzery', () => {
    expect(importTargetFromQuery(['  https://example.sk/r ', 'https://iny.sk'])).toBe('https://example.sk/r')
  })

  it('adresu bez protokolu doplní', () => {
    expect(importTargetFromQuery('example.sk/recept')).toBe('https://example.sk/recept')
  })

  it('chýbajúcu, prázdnu alebo neplatnú adresu odmietne', () => {
    expect(importTargetFromQuery(undefined)).toBeNull()
    expect(importTargetFromQuery('   ')).toBeNull()
    expect(importTargetFromQuery('https://')).toBeNull()
    expect(importTargetFromQuery('javascript:alert(1)')).toBeNull()
    expect(importTargetFromQuery('ftp://example.sk/r')).toBeNull()
  })
})

describe('buildImportUrl (rozšírenie do Chromu)', () => {
  const page = 'https://varecha.example.sk/recept?id=1&x=a b#krok'

  it('zloží adresu importu a zakóduje adresu stránky', () => {
    expect(buildImportUrl('https://kniha.example.com', page)).toBe(
      `https://kniha.example.com/recepty/import?url=${encodeURIComponent(page)}`,
    )
  })

  it('koncové lomky a medzery v adrese aplikácie nevadia', () => {
    expect(buildImportUrl('  https://kniha.example.com/// ', 'https://a.sk/r')).toBe(
      'https://kniha.example.com/recepty/import?url=https%3A%2F%2Fa.sk%2Fr',
    )
  })

  it('povolí aj vývojový localhost', () => {
    expect(buildImportUrl('http://localhost:5180', 'https://a.sk/r')).toBe(
      'http://localhost:5180/recepty/import?url=https%3A%2F%2Fa.sk%2Fr',
    )
  })

  it('karty mimo webu (chrome://, nová karta) alebo chýbajúca adresa aplikácie nič nevytvoria', () => {
    expect(buildImportUrl('https://kniha.example.com', 'chrome://extensions')).toBeNull()
    expect(buildImportUrl('https://kniha.example.com', undefined)).toBeNull()
    expect(buildImportUrl('', 'https://a.sk/r')).toBeNull()
    expect(buildImportUrl(undefined, 'https://a.sk/r')).toBeNull()
    expect(buildImportUrl('kniha.example.com', 'https://a.sk/r')).toBeNull()
    expect(buildImportUrl('http://example.com', 'https://a.sk/r')).toBeNull()
  })
})
