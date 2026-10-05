import { describe, expect, it } from 'vitest'
import { entryPortions } from '@shared/portions'

const adult = { kind: 'adult' as const, portionFactor: 1, isActive: true }
const child = { kind: 'child' as const, portionFactor: 0.5, isActive: true }
const away = { kind: 'adult' as const, portionFactor: 1, isActive: false }

describe('entryPortions', () => {
  it('sčíta porcie aktívnych členov', () => {
    expect(
      entryPortions({ servingsOverride: null, audience: 'all' }, [adult, adult, child, child, away]),
    ).toBe(3)
  })

  it('ručne zadané porcie majú prednosť', () => {
    expect(entryPortions({ servingsOverride: 6, audience: 'all' }, [adult])).toBe(6)
  })

  it('pre dospelých alebo deti počíta len danú skupinu', () => {
    expect(entryPortions({ servingsOverride: null, audience: 'adults' }, [adult, adult, child])).toBe(2)
    expect(entryPortions({ servingsOverride: null, audience: 'children' }, [adult, child, child])).toBe(1)
  })

  it('bez členov vráti null', () => {
    expect(entryPortions({ servingsOverride: null, audience: 'all' }, [])).toBeNull()
    expect(entryPortions({ servingsOverride: null, audience: 'all' }, [away])).toBeNull()
  })

  it('zaokrúhli na štvrtiny porcie', () => {
    const third = { kind: 'child' as const, portionFactor: 0.33, isActive: true }
    expect(entryPortions({ servingsOverride: null, audience: 'all' }, [third, third, third])).toBe(1)
  })
})
