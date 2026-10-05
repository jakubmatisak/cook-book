import { describe, expect, it } from 'vitest'
import { describeCadence, describeExpiry, expiryStatus, summarizeGenerate } from '@/features/pantry/format'

const TODAY = '2026-10-05'

describe('expiryStatus', () => {
  it('rozlíši bez dátumu, po trvanlivosti, čoskoro a v poriadku', () => {
    expect(expiryStatus(null, TODAY)).toBe('none')
    expect(expiryStatus('2026-10-04', TODAY)).toBe('expired')
    expect(expiryStatus('2026-10-05', TODAY)).toBe('soon')
    expect(expiryStatus('2026-10-08', TODAY)).toBe('soon')
    expect(expiryStatus('2026-10-09', TODAY)).toBe('ok')
  })

  it('hranicu „čoskoro“ možno zmeniť', () => {
    expect(expiryStatus('2026-10-12', TODAY, 7)).toBe('soon')
    expect(expiryStatus('2026-10-13', TODAY, 7)).toBe('ok')
  })
})

describe('describeExpiry', () => {
  it('opíše trvanlivosť po slovensky so správnym skloňovaním', () => {
    expect(describeExpiry(null, TODAY)).toBe('')
    expect(describeExpiry('2026-10-05', TODAY)).toBe('Expiruje dnes')
    expect(describeExpiry('2026-10-06', TODAY)).toBe('Expiruje zajtra')
    expect(describeExpiry('2026-10-08', TODAY)).toBe('Expiruje o 3 dni')
    expect(describeExpiry('2026-10-15', TODAY)).toBe('Expiruje o 10 dní')
    expect(describeExpiry('2026-10-04', TODAY)).toBe('Po trvanlivosti 1 deň')
    expect(describeExpiry('2026-10-01', TODAY)).toBe('Po trvanlivosti 4 dni')
    expect(describeExpiry('2026-09-20', TODAY)).toBe('Po trvanlivosti 15 dní')
  })
})

describe('describeCadence', () => {
  it('opíše rytmus stálej položky', () => {
    expect(describeCadence(1)).toBe('Každý týždeň')
    expect(describeCadence(2)).toBe('Každé 2 týždne')
    expect(describeCadence(4)).toBe('Každé 4 týždne')
    expect(describeCadence(6)).toBe('Každých 6 týždňov')
  })
})

describe('summarizeGenerate', () => {
  const base = { added: 5, kept: 0, removed: 0, staples: 0, covered: [] as string[], reduced: [] as string[] }

  it('základná správa o počte položiek', () => {
    expect(summarizeGenerate(base)).toBe('Pridaných 5 položiek.')
    expect(summarizeGenerate({ ...base, added: 1 })).toBe('Pridaná 1 položka.')
    expect(summarizeGenerate({ ...base, added: 0 })).toBe('Nič nové na nákup.')
  })

  it('dopĺňa, čo urobila špajza a stále položky', () => {
    expect(summarizeGenerate({ ...base, covered: ['Múka', 'Vajcia'], reduced: ['Soľ'] })).toBe(
      'Pridaných 5 položiek. Špajza pokryla 2 položky (Múka, Vajcia) a znížila množstvo: Soľ.',
    )
    expect(summarizeGenerate({ ...base, staples: 2 })).toBe('Pridaných 5 položiek, z toho 2 stále.')
    expect(summarizeGenerate({ ...base, added: 0, covered: ['A', 'B', 'C'] })).toBe(
      'Nič nové na nákup. Špajza pokryla 3 položky (A, B, C).',
    )
    expect(summarizeGenerate({ ...base, reduced: ['Múka', 'Cukor'] })).toBe(
      'Pridaných 5 položiek. Špajza znížila množstvo: Múka, Cukor.',
    )
    expect(summarizeGenerate({ ...base, covered: ['A', 'B', 'C', 'D', 'E', 'F'] })).toBe(
      'Pridaných 5 položiek. Špajza pokryla 6 položiek (A, B, C, D…).',
    )
  })
})

describe('summarizeGenerate – kúpené položky', () => {
  it('spomenie ponechané kúpené položky', () => {
    expect(
      summarizeGenerate({
        added: 2,
        kept: 3,
        removed: 1,
        staples: 0,
        covered: [],
        reduced: [],
      }),
    ).toBe('Pridané 2 položky. Ponechané kúpené: 3.')
  })
})
