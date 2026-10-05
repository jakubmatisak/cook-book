import { describe, expect, it } from 'vitest'
import { formatFraction, formatScaled, scaleQuantity } from '@shared/scaling'

describe('scaleQuantity', () => {
  it('kusy a lyžice zaokrúhli na štvrtiny, ale nikdy na nulu', () => {
    expect(scaleQuantity(3, 1.5, 'ks')).toBe(4.5)
    expect(scaleQuantity(1, 0.33, 'PL')).toBe(0.25)
    expect(scaleQuantity(1, 0.01, 'ks')).toBe(0.25)
    expect(scaleQuantity(2, 1.1, 'šálka')).toBe(2.25)
  })

  it('gramy a mililitre zaokrúhli na celé, nad 100 na päťky', () => {
    expect(scaleQuantity(800, 0.625, 'g')).toBe(500)
    expect(scaleQuantity(125, 1.5, 'g')).toBe(190)
    expect(scaleQuantity(33, 0.5, 'ml')).toBe(17)
    expect(scaleQuantity(3, 0.01, 'g')).toBe(1)
  })

  it('kg a l na dve desatinné miesta, bez množstva ostane bez množstva', () => {
    expect(scaleQuantity(0.75, 1.3333, 'kg')).toBe(1)
    expect(scaleQuantity(1, 0.333, 'l')).toBe(0.33)
    expect(scaleQuantity(null, 2, 'ks')).toBeNull()
  })

  it('faktor 1 množstvo nemení', () => {
    expect(scaleQuantity(250, 1, 'g')).toBe(250)
    expect(scaleQuantity(1.5, 1, 'kg')).toBe(1.5)
  })
})

describe('formatFraction', () => {
  it('štvrtiny zobrazí ako zlomky, ostatné s čiarkou', () => {
    expect(formatFraction(4.5)).toBe('4 ½')
    expect(formatFraction(0.25)).toBe('¼')
    expect(formatFraction(1.75)).toBe('1 ¾')
    expect(formatFraction(2)).toBe('2')
    expect(formatFraction(1.3)).toBe('1,3')
  })
})

describe('formatScaled', () => {
  it('použije zlomky pre kusy a lyžice, inak bežný formát', () => {
    expect(formatScaled(3, 1.5, 'ks')).toBe('4 ½ ks')
    expect(formatScaled(2, 1.25, 'PL')).toBe('2 ½ PL')
    expect(formatScaled(800, 1.5, 'g')).toBe('1,2 kg')
    expect(formatScaled(1.3, 1, 'ks')).toBe('1,3 ks')
    expect(formatScaled(0.33, 1, 'šálka')).toBe('0,33 šálka')
    expect(formatScaled(null, 2, 'ks')).toBe('ks')
    expect(formatScaled(null, 2, null)).toBe('')
  })
})
