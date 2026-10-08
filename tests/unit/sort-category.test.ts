import { describe, expect, it } from 'vitest'
import { recipeListQuerySchema } from '@shared/schemas/recipe'
import { sortRecipes, type FacetRow } from '@shared/recipeFacets'
import { stateToTableSort, tableSortToState } from '@/features/recipes/listQuery'
import { i18n, setLocale } from '@/i18n'

const row = (title: string, category: string): FacetRow => ({
  id: title,
  title,
  category,
  difficulty: 1,
  totalMinutes: null,
  tagIds: [],
  isFavorite: false,
  createdAt: '2026-10-01T00:00:00Z',
  lastCookedAt: null,
})

describe('zoradenie receptov podľa kategórie', () => {
  const rows = [
    row('Šalát', 'salat'),
    row('Kôprová', 'omacka'),
    row('Guláš', 'hlavne'),
    row('Bryndzové', 'hlavne'),
  ]

  it('radí v poradí typov jedla, rovnaký typ podľa názvu; zostupne naopak', () => {
    expect(sortRecipes(rows, 'category', 'asc').map((r) => r.title)).toEqual([
      'Bryndzové',
      'Guláš',
      'Kôprová',
      'Šalát',
    ])
    expect(sortRecipes(rows, 'category', 'desc').map((r) => r.title)).toEqual([
      'Šalát',
      'Kôprová',
      'Bryndzové',
      'Guláš',
    ])
  })

  it('stĺpec Kategória v tabuľke sa dá zoradiť a adresa ho prijme', () => {
    expect(tableSortToState([{ key: 'category', order: 'desc' }])).toEqual({ sort: 'category', dir: 'desc' })
    expect(stateToTableSort('category', undefined)).toEqual([{ key: 'category', order: 'asc' }])
    expect(recipeListQuerySchema.parse({ sort: 'category' }).sort).toBe('category')
  })

  it('má názov v zozname zoradenia po slovensky aj po anglicky', () => {
    setLocale('sk')
    expect(i18n.global.t('common.sort.category')).toBe('Kategória')
    setLocale('en')
    expect(i18n.global.t('common.sort.category')).toBe('Category')
    setLocale('sk')
  })
})
