import { describe, expect, it } from 'vitest'
import { formatDate, formatMinutes, plural, totalMinutes } from '@/lib/format'

describe('formatMinutes', () => {
  it('pod hodinu ukáže minúty, inak hodiny a minúty', () => {
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(60)).toBe('1 h')
    expect(formatMinutes(90)).toBe('1 h 30 min')
    expect(formatMinutes(0)).toBe('0 min')
  })
})

describe('totalMinutes', () => {
  it('sčíta prípravu a varenie a ignoruje chýbajúce hodnoty', () => {
    expect(totalMinutes(20, 40)).toBe(60)
    expect(totalMinutes(null, 40)).toBe(40)
    expect(totalMinutes(null, null)).toBeNull()
  })
})

describe('plural', () => {
  it('použije slovenský tvar podľa počtu', () => {
    const porcie = (n: number) => plural(n, 'porcia', 'porcie', 'porcií')
    expect([0, 1, 2, 4, 5, 11].map(porcie)).toEqual([
      '0 porcií',
      '1 porcia',
      '2 porcie',
      '4 porcie',
      '5 porcií',
      '11 porcií',
    ])
    expect(porcie(1.5)).toBe('1,5 porcie')
  })
})

describe('formatDate', () => {
  it('prevedie ISO dátum aj čas na slovenský zápis', () => {
    expect(formatDate('2026-10-05')).toBe('5. 10. 2026')
    expect(formatDate('2026-01-15T10:30:00.000Z')).toBe('15. 1. 2026')
  })
})
