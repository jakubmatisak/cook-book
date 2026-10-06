import { describe, expect, it } from 'vitest'
import type { MealSlotDto, PlanEntryDto } from '@shared/api'
import type { RecipeCategory } from '@shared/recipes'
import {
  filterEntriesByCategory,
  groupEntries,
  resolveWeekStart,
  visibleSlots,
} from '@/features/meal-plan/week'

const slot = (id: string, sortOrder: number, isEnabled = true): MealSlotDto => ({
  id,
  name: id,
  sortOrder,
  isEnabled,
  defaultTime: null,
})

const entry = (id: string, date: string, slotId: string): PlanEntryDto => ({
  id,
  date,
  slotId,
  recipeId: null,
  recipe: null,
  freeText: id,
  servingsOverride: null,
  note: null,
  sortOrder: 0,
  audience: 'all',
  guestIds: [],
  warnings: [],
})

describe('resolveWeekStart', () => {
  it('bez parametra vráti začiatok aktuálneho týždňa', () => {
    expect(resolveWeekStart(undefined, 1, '2026-10-08')).toBe('2026-10-05')
    expect(resolveWeekStart(undefined, 0, '2026-10-08')).toBe('2026-10-04')
  })

  it('dátum z URL zarovná na začiatok týždňa, nezmysel ignoruje', () => {
    expect(resolveWeekStart('2026-10-14', 1, '2026-10-08')).toBe('2026-10-12')
    expect(resolveWeekStart('zajtra', 1, '2026-10-08')).toBe('2026-10-05')
  })
})

describe('visibleSlots', () => {
  it('ukáže zapnuté jedlá a vypnuté len vtedy, keď v nich niečo je, v poradí', () => {
    const slots = [
      slot('vecera', 4),
      slot('ranajky', 0),
      slot('desiata', 1, false),
      slot('olovrant', 3, false),
    ]
    expect(visibleSlots(slots, []).map((s) => s.id)).toEqual(['ranajky', 'vecera'])
    expect(visibleSlots(slots, [entry('e', '2026-10-05', 'olovrant')]).map((s) => s.id)).toEqual([
      'ranajky',
      'olovrant',
      'vecera',
    ])
  })
})

describe('groupEntries', () => {
  it('zoskupí záznamy podľa dňa a jedla so zachovaním poradia', () => {
    const groups = groupEntries([
      entry('a', '2026-10-05', 'obed'),
      entry('b', '2026-10-05', 'obed'),
      entry('c', '2026-10-06', 'obed'),
    ])
    expect(groups.get('2026-10-05|obed')?.map((e) => e.id)).toEqual(['a', 'b'])
    expect(groups.get('2026-10-06|obed')?.map((e) => e.id)).toEqual(['c'])
    expect(groups.get('2026-10-07|obed')).toBeUndefined()
  })
})

describe('filterEntriesByCategory', () => {
  const withRecipe = (id: string, category: RecipeCategory): PlanEntryDto => ({
    ...entry(id, '2026-10-05', 'obed'),
    recipeId: id,
    freeText: null,
    recipe: { id, title: id, servings: 4, coverImageUrl: null, deleted: false, category },
  })
  const all = [
    withRecipe('gulas', 'hlavne'),
    withRecipe('kolac', 'dezert'),
    entry('zvysky', '2026-10-05', 'obed'),
  ]

  it('bez zvolených typov vráti všetky záznamy vrátane ručných', () => {
    expect(filterEntriesByCategory(all, []).map((e) => e.id)).toEqual(['gulas', 'kolac', 'zvysky'])
  })

  it('so zvolenými typmi nechá len recepty daného typu a skryje ručné záznamy', () => {
    expect(filterEntriesByCategory(all, ['dezert']).map((e) => e.id)).toEqual(['kolac'])
    expect(filterEntriesByCategory(all, ['dezert', 'hlavne']).map((e) => e.id)).toEqual(['gulas', 'kolac'])
  })
})
