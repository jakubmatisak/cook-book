import { describe, expect, it } from 'vitest'
import { matchesSearch } from '@/lib/search'

describe('matchesSearch', () => {
  it('nájde text bez ohľadu na diakritiku a veľkosť písmen', () => {
    expect(matchesSearch('Hovädzí guláš', 'gulas')).toBe(true)
    expect(matchesSearch('Hovädzí guláš', 'HOVADZI')).toBe(true)
    expect(matchesSearch('Palacinky', 'gulas')).toBe(false)
  })

  it('prázdne hľadanie zodpovedá všetkému', () => {
    expect(matchesSearch('Čokoľvek', '')).toBe(true)
    expect(matchesSearch('Čokoľvek', null)).toBe(true)
  })
})
