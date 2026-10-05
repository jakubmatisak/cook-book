import { useMutation, useQuery, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import type { IngredientDto, ShopCategoryDto, TagDto } from '@shared/api'
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
