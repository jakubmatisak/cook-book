import { describe, expect, it } from 'vitest'
import { applyRecipeFilters, computeFacets, type FacetRow } from '@shared/recipeFacets'
import { RECIPE_CATEGORIES } from '@shared/recipes'
import { parseListQuery, savableListQuery } from '@/features/recipes/listQuery'

const row = (id: string, category: string): FacetRow => ({
  id,
  title: id,
  category,
  difficulty: 1,
  totalMinutes: 20,
  tagIds: [],
  isFavorite: false,
  createdAt: '2026-10-01T10:00:00.000Z',
  lastCookedAt: null,
})

const rows = [row('Guláš', 'hlavne'), row('Ovsená kaša', 'detske'), row('Palacinky', 'dezert')]
const ids = (filters: Parameters<typeof applyRecipeFilters>[1]) =>
  applyRecipeFilters(rows, filters).map((r) => r.id)

describe('kategória Detské', () => {
  it('je medzi typmi jedla', () => {
    expect(RECIPE_CATEGORIES).toContain('detske')
  })

  it('detské recepty sa v zozname skrývajú, kým sa nezapne „aj detské“', () => {
    expect(ids({})).toEqual(['Guláš', 'Palacinky'])
    expect(ids({ includeKids: true })).toEqual(['Guláš', 'Ovsená kaša', 'Palacinky'])
  })

  it('výslovne zvolená kategória Detské ich ukáže aj bez prepínača', () => {
    expect(ids({ category: ['detske'] })).toEqual(['Ovsená kaša'])
    expect(ids({ category: ['detske', 'dezert'] })).toEqual(['Ovsená kaša', 'Palacinky'])
  })

  it('počty pri filtroch zodpovedajú tomu, čo sa ukáže', () => {
    expect(computeFacets(rows, {}).category).toEqual({ hlavne: 1, dezert: 1 })
    expect(computeFacets(rows, { includeKids: true }).category).toEqual({ hlavne: 1, detske: 1, dezert: 1 })
  })
})

describe('prepínač „aj detské“ v adrese', () => {
  it('detske=1 zapne zobrazenie, bez neho je vypnuté', () => {
    expect(parseListQuery({}).kids).toBe(false)
    expect(parseListQuery({ detske: '1' }).kids).toBe(true)
    expect(parseListQuery({ detske: '0' }).kids).toBe(false)
  })

  it('ukladá sa medzi predvolené filtre', () => {
    expect(savableListQuery({ detske: '1', q: 'kaša' })).toEqual({ detske: '1' })
  })
})
