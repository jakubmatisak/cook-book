import { describe, expect, it } from 'vitest'
import { formatQuantity, isUnitCode, toBase, UNITS } from '@shared/units'

describe('toBase', () => {
  it('prevedie kg na g a l na ml', () => {
    expect(toBase(1.25, 'kg')).toEqual({ quantity: 1250, unit: 'g' })
    expect(toBase(0.5, 'l')).toEqual({ quantity: 500, unit: 'ml' })
  })
  it('nemení jednotky bez prevodu', () => {
    expect(toBase(2, 'PL')).toEqual({ quantity: 2, unit: 'PL' })
    expect(toBase(3, 'ks')).toEqual({ quantity: 3, unit: 'ks' })
  })
})

describe('formatQuantity', () => {
  it('používa desatinnú čiarku a odstráni koncové nuly', () => {
    expect(formatQuantity(1.5, 'ks')).toBe('1,5 ks')
    expect(formatQuantity(2.0, 'PL')).toBe('2 PL')
    expect(formatQuantity(0.333333, 'šálka')).toBe('0,33 šálka')
  })
  it('povýši g na kg a ml na l od 1000', () => {
    expect(formatQuantity(1250, 'g')).toBe('1,25 kg')
    expect(formatQuantity(999, 'g')).toBe('999 g')
    expect(formatQuantity(1500, 'ml')).toBe('1,5 l')
  })
  it('zvládne chýbajúce množstvo alebo jednotku', () => {
    expect(formatQuantity(null, 'štipka')).toBe('štipka')
    expect(formatQuantity(3, null)).toBe('3')
    expect(formatQuantity(null, null)).toBe('')
  })
  it('neplatné čísla nezobrazí', () => {
    expect(formatQuantity(Number.NaN, 'g')).toBe('g')
    expect(formatQuantity(-2, 'g')).toBe('g')
  })
})

describe('UNITS', () => {
  it('má unikátne kódy a isUnitCode ich rozpozná', () => {
    const codes = UNITS.map((u) => u.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(isUnitCode('kg')).toBe(true)
    expect(isUnitCode('libra')).toBe(false)
  })
})
