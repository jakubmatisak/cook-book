import { useMutation, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import type { BulkAffectedDto, IngredientBulkDeleteResult } from '@shared/api'
import { BULK_MAX, type IngredientBulkUpdate, type RecipeBulkUpdate } from '@shared/schemas/bulk'
import { apiFetch } from './http'
import { INGREDIENTS_KEY, markIngredientsStale } from './ingredientCache'

const post = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })

/** Väčší výber sa pošle po dávkach (server prijme najviac `BULK_MAX` položiek na jedno volanie). */
export async function inBatches<T>(
  ids: readonly string[],
  run: (batch: string[]) => Promise<T>,
): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < ids.length; i += BULK_MAX) results.push(await run(ids.slice(i, i + BULK_MAX)))
  return results
}

const sum = (results: BulkAffectedDto[]) => results.reduce((total, r) => total + r.affected, 0)

export type RecipeChange = Omit<RecipeBulkUpdate, 'ids'>
export type IngredientChange = Omit<IngredientBulkUpdate, 'ids'>
export interface BulkVars<C> {
  ids: readonly string[]
  change: C
}

export function useBulkDeleteRecipes(): UseMutationReturnType<number, Error, readonly string[], unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (ids: readonly string[]) =>
      sum(await inBatches(ids, (batch) => post<BulkAffectedDto>('/recipes/bulk/delete', { ids: batch }))),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['recipes'] })
      void client.invalidateQueries({ queryKey: ['plan'] })
      void client.invalidateQueries({ queryKey: ['shopping'] })
      markIngredientsStale(client)
    },
  })
}

export function useBulkUpdateRecipes(): UseMutationReturnType<
  number,
  Error,
  BulkVars<RecipeChange>,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, change }: BulkVars<RecipeChange>) =>
      sum(
        await inBatches(ids, (batch) =>
          post<BulkAffectedDto>('/recipes/bulk/update', { ids: batch, ...change }),
        ),
      ),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['recipes'] })
      void client.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}

export function useBulkUpdateIngredients(): UseMutationReturnType<
  number,
  Error,
  BulkVars<IngredientChange>,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, change }: BulkVars<IngredientChange>) =>
      sum(
        await inBatches(ids, (batch) =>
          post<BulkAffectedDto>('/ingredients/bulk/update', { ids: batch, ...change }),
        ),
      ),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: INGREDIENTS_KEY })
      void client.invalidateQueries({ queryKey: ['shopping'] })
    },
  })
}

export function useBulkDeleteIngredients(): UseMutationReturnType<
  IngredientBulkDeleteResult,
  Error,
  readonly string[],
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (ids: readonly string[]) => {
      const results = await inBatches(ids, (batch) =>
        post<IngredientBulkDeleteResult>('/ingredients/bulk/delete', { ids: batch }),
      )
      return {
        deleted: results.reduce((total, r) => total + r.deleted, 0),
        skipped: results.flatMap((r) => r.skipped),
      }
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: INGREDIENTS_KEY })
      void client.invalidateQueries({ queryKey: ['pantry'] })
      void client.invalidateQueries({ queryKey: ['staples'] })
    },
  })
}
