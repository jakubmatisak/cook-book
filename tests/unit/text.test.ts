import { describe, expect, it } from 'vitest'
import { normalizeText, slugify } from '@shared/text'

describe('normalizeText', () => {
  it('odstráni diakritiku, zmenší písmená a zlúči medzery', () => {
    expect(normalizeText('  Hovädzí   GULÁŠ ')).toBe('hovadzi gulas')
    expect(normalizeText('Čučoriedkový koláč s ľadom')).toBe('cucoriedkovy kolac s ladom')
    expect(normalizeText('Ťažké ŇUFÁKY')).toBe('tazke nufaky')
  })

  it('prázdny vstup ostane prázdny', () => {
    expect(normalizeText('   ')).toBe('')
  })
})

describe('slugify', () => {
  it('vytvorí URL slug bez diakritiky', () => {
    expect(slugify('Hovädzí guláš (po babkinom)')).toBe('hovadzi-gulas-po-babkinom')
    expect(slugify('  --Palacinky!!  ')).toBe('palacinky')
  })

  it('obmedzí dĺžku na 80 znakov bez pomlčky na konci', () => {
    const slug = slugify('a'.repeat(79) + ' bbbb')
    expect(slug.length).toBeLessThanOrEqual(80)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('pre text bez písmen vráti náhradný slug', () => {
    expect(slugify('!!!')).toBe('recept')
  })
})
