import { useMutation, useQuery, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import type { IngredientDto, PantryDto, ShopCategoryDto, TagDto } from '@shared/api'
import type { TagInput } from '@shared/schemas/recipe'
import type { UnitCode } from '@shared/units'
import { apiFetch } from './http'

export const useIngredients = () =>
  useQuery({
    queryKey: ['ingredients'],
    queryFn: () => apiFetch<IngredientDto[]>('/ingredients'),
    staleTime: 60_000,
  })

export const useTags = () =>
  useQuery({ queryKey: ['tags'], queryFn: () => apiFetch<TagDto[]>('/tags'), staleTime: 60_000 })

export const useShopCategories = () =>
  useQuery({
    queryKey: ['shop-categories'],
    queryFn: () => apiFetch<ShopCategoryDto[]>('/shop-categories'),
    staleTime: 5 * 60_000,
  })

export interface IngredientPatch {
  name?: string
  defaultUnit?: UnitCode | null
  shopCategoryId?: string | null
}

export interface UpdateIngredientVars {
  id: string
  patch: IngredientPatch
}

export function useUpdateIngredient(): UseMutationReturnType<
  IngredientDto,
  Error,
  UpdateIngredientVars,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: UpdateIngredientVars) =>
      apiFetch<IngredientDto>(`/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: (updated) => {
      client.setQueryData<IngredientDto[]>(['ingredients'], (old) =>
        old?.map((i) => (i.id === updated.id ? updated : i)),
      )
      void client.invalidateQueries({ queryKey: ['recipes'] })
    },
  })
}

// ─── Tagy ────────────────────────────────────────────────────────────────────

const invalidateTags = (client: ReturnType<typeof useQueryClient>) => {
  void client.invalidateQueries({ queryKey: ['tags'] })
  void client.invalidateQueries({ queryKey: ['recipes'] })
}

export interface SaveTagVars {
  id?: string
  input: TagInput
}

export function useSaveTag(): UseMutationReturnType<TagDto, Error, SaveTagVars, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: SaveTagVars) =>
      apiFetch<TagDto>(id ? `/tags/${id}` : '/tags', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateTags(client),
  })
}

export function useDeleteTag(): UseMutationReturnType<void, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateTags(client),
  })
}

// ─── Špajza ──────────────────────────────────────────────────────────────────

export const usePantry = () =>
  useQuery({ queryKey: ['pantry'], queryFn: () => apiFetch<PantryDto>('/pantry'), staleTime: 60_000 })

export interface PantryToggleVars {
  ingredientId: string
  inPantry: boolean
}

/** Označí ingredienciu „mám doma“ hneď v UI, server sa dobehne. */
export function useTogglePantry(): UseMutationReturnType<void, Error, PantryToggleVars, void> {
  const client = useQueryClient()
  const patch = (ingredientId: string, inPantry: boolean) =>
    client.setQueryData<PantryDto>(['pantry'], (old) => {
      const ids = new Set(old?.ingredientIds ?? [])
      if (inPantry) ids.add(ingredientId)
      else ids.delete(ingredientId)
      return { ingredientIds: [...ids] }
    })
  return useMutation({
    mutationFn: ({ ingredientId, inPantry }: PantryToggleVars) =>
      apiFetch<void>(`/pantry/${ingredientId}`, { method: inPantry ? 'PUT' : 'DELETE' }),
    onMutate: ({ ingredientId, inPantry }) => {
      patch(ingredientId, inPantry)
    },
    onError: (_e, { ingredientId, inPantry }) => patch(ingredientId, !inPantry),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['pantry'] })
      void client.invalidateQueries({ queryKey: ['recipes'] })
    },
  })
}
