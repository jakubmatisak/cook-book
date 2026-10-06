import type { QueryClient } from '@tanstack/vue-query'
import type { IngredientDto, RecipeDetailDto, StapleDto } from '@shared/api'
import { normalizeText } from '@shared/text'

/**
 * Zoznam surovín sa stiahne raz za beh aplikácie. Nové suroviny (z uloženého receptu, stálej položky
 * alebo štartovacieho zoznamu) sa doplnia priamo do tejto pamäte z odpovedí servera, bez ďalšieho GET.
 */
export const INGREDIENTS_KEY = ['ingredients'] as const

const byName = (a: IngredientDto, b: IngredientDto) =>
  normalizeText(a.name).localeCompare(normalizeText(b.name), 'sk')

/**
 * Pridá suroviny, ktoré v zozname ešte nie sú (podľa id); známe nechá, ako sú. Bez načítaného
 * zoznamu vráti undefined: prvé načítanie už nové suroviny zahrnie.
 */
export function mergeIngredients(
  old: readonly IngredientDto[] | undefined,
  incoming: readonly IngredientDto[],
): IngredientDto[] | undefined {
  if (!old) return undefined
  const known = new Set(old.map((i) => i.id))
  const fresh = incoming.filter((i) => !known.has(i.id))
  return fresh.length ? [...old, ...fresh].sort(byName) : [...old]
}

/** Suroviny uloženého receptu, každá raz, s jednotkou prvého použitia. */
export function ingredientsFromRecipe(recipe: RecipeDetailDto): IngredientDto[] {
  const seen = new Map<string, IngredientDto>()
  for (const i of recipe.ingredients) {
    if (seen.has(i.ingredientId)) continue
    seen.set(i.ingredientId, {
      id: i.ingredientId,
      name: i.name,
      defaultUnit: i.unit,
      shopCategoryId: null,
      usageCount: 1,
    })
  }
  return [...seen.values()]
}

export const ingredientFromStaple = (staple: StapleDto): IngredientDto => ({
  id: staple.ingredientId,
  name: staple.name,
  defaultUnit: staple.unit,
  shopCategoryId: null,
  usageCount: 0,
})

/**
 * Označí zoznam za zastaraný bez sťahovania: počty použití v receptoch sa obnovia, až keď sa otvorí
 * stránka Ingrediencie (tá sa po zastaraní načíta znova), nie pri každom okne.
 */
export const markIngredientsStale = (client: QueryClient) =>
  void client.invalidateQueries({ queryKey: INGREDIENTS_KEY, refetchType: 'none' })

export function addIngredientsToCache(client: QueryClient, incoming: readonly IngredientDto[]): void {
  client.setQueryData<IngredientDto[]>(INGREDIENTS_KEY, (old) => mergeIngredients(old, incoming))
  markIngredientsStale(client)
}
