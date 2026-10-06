import { useMutation, useQuery, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { PublicRecipeDetailDto, RecipeDetailDto } from '@shared/api'
import type { RecipeVisibility } from '@shared/recipes'
import { apiFetch } from './http'
import { recipeKeys } from './recipes'

export const publicKeys = {
  all: ['public'] as const,
  detail: (id: string) => ['public', 'recipe', id] as const,
}

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
