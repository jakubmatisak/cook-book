import { describe, expect, it } from 'vitest'
import type { PlanEntryDto } from '@shared/api'
import { entryToInput, moveTarget } from '@/features/meal-plan/week'

const entry: PlanEntryDto = {
  id: 'e1',
  date: '2026-10-05',
  slotId: 'obed',
  recipeId: 'r1',
  recipe: { id: 'r1', title: 'Guláš', servings: 4, coverImageUrl: null, deleted: false },
  freeText: null,
  servingsOverride: 6,
  note: 'bez soli',
  sortOrder: 2,
  audience: 'all',
  warnings: [],
}

describe('entryToInput', () => {
  it('prevedie záznam plánu na vstup uloženia na nový deň a jedlo', () => {
    expect(entryToInput(entry, '2026-10-07', 'vecera')).toEqual({
      date: '2026-10-07',
      slotId: 'vecera',
      recipeId: 'r1',
      freeText: null,
      servingsOverride: 6,
      note: 'bez soli',
    })
  })

  it('voľný text a poznámku zachová, zmazaný recept ponechá', () => {
    const free: PlanEntryDto = {
      ...entry,
      recipeId: null,
      recipe: null,
      freeText: 'Zvyšky',
      note: null,
      servingsOverride: null,
    }
    expect(entryToInput(free, '2026-10-06', 'obed')).toMatchObject({
      recipeId: null,
      freeText: 'Zvyšky',
      note: null,
    })
    const deleted: PlanEntryDto = { ...entry, recipe: { ...entry.recipe!, deleted: true } }
    expect(entryToInput(deleted, '2026-10-06', 'obed').recipeId).toBe('r1')
  })
})

describe('moveTarget', () => {
  it('rozpozná, či sa záznam skutočne presúva inam', () => {
    expect(moveTarget(entry, '2026-10-05', 'obed')).toBeNull()
    expect(moveTarget(entry, '2026-10-06', 'obed')).toEqual({ date: '2026-10-06', slotId: 'obed' })
    expect(moveTarget(entry, '2026-10-05', 'vecera')).toEqual({ date: '2026-10-05', slotId: 'vecera' })
  })
})
