import { describe, expect, it } from 'vitest'
import { fitWithin } from '@/lib/image'

describe('fitWithin', () => {
  it('zmenší dlhšiu stranu na limit a zachová pomer', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(1000, 3000, 1600)).toEqual({ width: 533, height: 1600 })
  })

  it('malý obrázok nezväčší', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('nikdy nevráti nulový rozmer', () => {
    expect(fitWithin(10_000, 1, 1600)).toEqual({ width: 1600, height: 1 })
  })
})
