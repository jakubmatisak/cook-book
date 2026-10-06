import { describe, expect, it } from 'vitest'
import { STARTER_INGREDIENTS } from '@shared/data/starterIngredients'
import { normalizeText } from '@shared/text'
import { UNIT_CODES } from '@shared/units'

describe('štartovací zoznam surovín', () => {
  it('má dosť položiek a každá má názov, jednotku a kategóriu', () => {
    expect(STARTER_INGREDIENTS.length).toBeGreaterThanOrEqual(150)
    for (const item of STARTER_INGREDIENTS) {
      expect(item.name.trim(), item.name).toBe(item.name)
      expect(item.name.length).toBeGreaterThan(1)
      expect(UNIT_CODES as readonly string[], item.name).toContain(item.unit)
      expect(item.category.length).toBeGreaterThan(0)
    }
  })

  it('názvy sa po normalizácii (bez diakritiky a veľkosti písmen) neopakujú', () => {
    const seen = new Map<string, string>()
    for (const item of STARTER_INGREDIENTS) {
      const key = normalizeText(item.name)
      expect(seen.get(key), `${item.name} sa opakuje s ${seen.get(key)}`).toBeUndefined()
      seen.set(key, item.name)
    }
  })

  it('obsahuje základné suroviny, ktoré v slovenských receptoch nesmú chýbať', () => {
    const names = new Set(STARTER_INGREDIENTS.map((i) => normalizeText(i.name)))
    for (const basic of [
      'zemiaky',
      'cibula',
      'hovadzie maso',
      'hladka muka',
      'mlieko',
      'vajcia',
      'maslo',
      'sol',
    ]) {
      expect(names.has(basic), basic).toBe(true)
    }
  })
})
