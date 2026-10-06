import { QueryClient } from '@tanstack/vue-query'
import { describe, expect, it } from 'vitest'
import type { IngredientDto, RecipeDetailDto, StapleDto } from '@shared/api'
import {
  addIngredientsToCache,
  ingredientFromStaple,
  ingredientsFromRecipe,
  INGREDIENTS_KEY,
  markIngredientsStale,
  mergeIngredients,
} from '@/api/ingredientCache'

const ing = (id: string, name: string, extra: Partial<IngredientDto> = {}): IngredientDto => ({
  id,
  name,
  defaultUnit: null,
  shopCategoryId: null,
  usageCount: 0,
  ...extra,
})

describe('mergeIngredients', () => {
  it('pridá chýbajúce podľa id a zoradí podľa názvu bez diakritiky', () => {
    const old = [ing('1', 'Cibuľa'), ing('3', 'Mlieko')]
    const merged = mergeIngredients(old, [ing('2', 'Čaj'), ing('4', 'Zemiaky')])!
    expect(merged.map((i) => i.name)).toEqual(['Čaj', 'Cibuľa', 'Mlieko', 'Zemiaky'])
    expect(old).toHaveLength(2)
  })

  it('už známu ingredienciu neprepíše ani nezduplikuje', () => {
    const old = [ing('1', 'Cibuľa', { shopCategoryId: 'zelenina', usageCount: 5 })]
    expect(mergeIngredients(old, [ing('1', 'Cibuľa', { usageCount: 1 })])).toEqual(old)
  })

  it('bez načítaného zoznamu nič nerobí, prvé načítanie ich už zahrnie', () => {
    expect(mergeIngredients(undefined, [ing('1', 'A')])).toBeUndefined()
  })
})

describe('ingredientsFromRecipe', () => {
  it('z uloženého receptu vytiahne jedinečné ingrediencie s jednotkou prvého použitia', () => {
    const recipe = {
      ingredients: [
        { ingredientId: 'a', name: 'Múka', unit: 'g' },
        { ingredientId: 'a', name: 'Múka', unit: 'kg' },
        { ingredientId: 'b', name: 'Soľ', unit: null },
      ],
    } as unknown as RecipeDetailDto
    expect(ingredientsFromRecipe(recipe)).toEqual([
      ing('a', 'Múka', { defaultUnit: 'g', usageCount: 1 }),
      ing('b', 'Soľ', { usageCount: 1 }),
    ])
  })
})

describe('ingredientFromStaple', () => {
  it('stála položka založí ingredienciu s jej jednotkou', () => {
    const staple = { ingredientId: 'm', name: 'Mlieko', unit: 'l' } as StapleDto
    expect(ingredientFromStaple(staple)).toEqual(ing('m', 'Mlieko', { defaultUnit: 'l' }))
  })
})

describe('vyrovnávacia pamäť zoznamu', () => {
  it('addIngredientsToCache doplní nové a označí zoznam za zastaraný bez sťahovania', () => {
    const client = new QueryClient()
    client.setQueryData(INGREDIENTS_KEY, [ing('1', 'Cibuľa')])
    addIngredientsToCache(client, [ing('2', 'Zemiaky')])
    expect(client.getQueryData<IngredientDto[]>(INGREDIENTS_KEY)!.map((i) => i.name)).toEqual([
      'Cibuľa',
      'Zemiaky',
    ])
    const state = client.getQueryState(INGREDIENTS_KEY)!
    expect(state.isInvalidated).toBe(true)
    expect(state.fetchStatus).toBe('idle')
  })

  it('markIngredientsStale nespustí žiadne sťahovanie', () => {
    const client = new QueryClient()
    client.setQueryData(INGREDIENTS_KEY, [ing('1', 'A')])
    markIngredientsStale(client)
    expect(client.getQueryState(INGREDIENTS_KEY)!.fetchStatus).toBe('idle')
    expect(client.getQueryState(INGREDIENTS_KEY)!.isInvalidated).toBe(true)
  })
})
