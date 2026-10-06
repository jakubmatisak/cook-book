import { useMutation, useQuery, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { PublicRecipeDetailDto, PublicRecipeSummaryDto, RecipeDetailDto } from '@shared/api'
import type { RecipeCategory, RecipeVisibility } from '@shared/recipes'
import { apiFetch } from './http'
import { recipeKeys } from './recipes'

export interface PublicRecipeFilters {
  q?: string | undefined
  category?: RecipeCategory[] | undefined
}

export const publicKeys = {
  all: ['public'] as const,
  list: (filters: PublicRecipeFilters) => ['public', 'recipes', filters] as const,
  detail: (id: string) => ['public', 'recipe', id] as const,
}

function toQuery(filters: PublicRecipeFilters): string {
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.category?.length) params.set('category', filters.category.join(','))
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** Verejné recepty všetkých domácností. */
export const usePublicRecipes = (filters: MaybeRefOrGetter<PublicRecipeFilters>) =>
  useQuery({
    queryKey: computed(() => publicKeys.list(toValue(filters))),
    queryFn: () => apiFetch<PublicRecipeSummaryDto[]>(`/public/recipes${toQuery(toValue(filters))}`),
    placeholderData: (previous) => previous,
  })

export const usePublicRecipe = (id: MaybeRefOrGetter<string | undefined>) =>
  useQuery({
    queryKey: computed(() => publicKeys.detail(toValue(id) ?? '')),
    queryFn: () => apiFetch<PublicRecipeDetailDto>(`/public/recipes/${toValue(id)}`),
    enabled: computed(() => Boolean(toValue(id))),
  })

/** Skopíruje verejný recept do aktívnej domácnosti; vráti nový (súkromný) recept. */
export function useCopyPublicRecipe(): UseMutationReturnType<RecipeDetailDto, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<RecipeDetailDto>(`/public/recipes/${id}/copy`, { method: 'POST' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['recipes', 'list'] })
      void client.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}

export interface VisibilityVars {
  id: string
  visibility: RecipeVisibility
}

/** Zverejní alebo skryje recept domácnosti (len vlastník). */
export function useSetRecipeVisibility(): UseMutationReturnType<
  RecipeDetailDto,
  Error,
  VisibilityVars,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, visibility }: VisibilityVars) =>
      apiFetch<RecipeDetailDto>(`/recipes/${id}/visibility`, {
        method: 'PUT',
        body: JSON.stringify({ visibility }),
      }),
    onSuccess: (recipe) => {
      client.setQueryData(recipeKeys.detail(recipe.id), recipe)
      void client.invalidateQueries({ queryKey: ['recipes', 'list'] })
      void client.invalidateQueries({ queryKey: publicKeys.all })
    },
  })
}
