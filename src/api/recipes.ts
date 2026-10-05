import { useMutation, useQuery, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { ImageDto, RecipeDetailDto, RecipeSummaryDto } from '@shared/api'
import type { RecipeCategory } from '@shared/recipes'
import type { RecipeInputRaw } from '@shared/schemas/recipe'
import { apiFetch } from './http'

export interface RecipeFilters {
  q?: string
  category?: RecipeCategory
  tag?: string
  favorite?: boolean
  /** „Čo viem uvariť“: zoradiť podľa toho, čo je doma, s chýbajúcimi ingredienciami. */
  pantry?: boolean
}

export const recipeKeys = {
  all: ['recipes'] as const,
  list: (filters: RecipeFilters) => ['recipes', 'list', filters] as const,
  detail: (id: string) => ['recipes', 'detail', id] as const,
}

function toQuery(filters: RecipeFilters): string {
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.category) params.set('category', filters.category)
  if (filters.tag) params.set('tag', filters.tag)
  if (filters.favorite) params.set('favorite', '1')
  if (filters.pantry) params.set('pantry', '1')
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function useRecipes(filters: MaybeRefOrGetter<RecipeFilters>) {
  return useQuery({
    queryKey: computed(() => recipeKeys.list(toValue(filters))),
    queryFn: () => apiFetch<RecipeSummaryDto[]>(`/recipes${toQuery(toValue(filters))}`),
    placeholderData: (previous) => previous,
  })
}

export function useRecipe(id: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: computed(() => recipeKeys.detail(toValue(id) ?? '')),
    queryFn: () => apiFetch<RecipeDetailDto>(`/recipes/${toValue(id)}`),
    enabled: computed(() => Boolean(toValue(id))),
  })
}

export interface SaveRecipeVars {
  id?: string
  input: RecipeInputRaw
}

export function useSaveRecipe(): UseMutationReturnType<RecipeDetailDto, Error, SaveRecipeVars, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: SaveRecipeVars) =>
      apiFetch<RecipeDetailDto>(id ? `/recipes/${id}` : '/recipes', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (detail) => {
      client.setQueryData(recipeKeys.detail(detail.id), detail)
      void client.invalidateQueries({ queryKey: ['recipes', 'list'] })
      void client.invalidateQueries({ queryKey: ['ingredients'] })
      void client.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}

export function useDeleteRecipe(): UseMutationReturnType<void, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/recipes/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: recipeKeys.detail(id) })
      void client.invalidateQueries({ queryKey: ['recipes', 'list'] })
    },
  })
}

/** Prepne obľúbené s okamžitou (optimistickou) zmenou v detaile aj zoznamoch. */
export interface FavoriteVars {
  id: string
  favorite: boolean
}

export function useToggleFavorite(): UseMutationReturnType<void, Error, FavoriteVars, void> {
  const client = useQueryClient()
  const patch = (id: string, isFavorite: boolean) => {
    client.setQueryData<RecipeDetailDto>(recipeKeys.detail(id), (old) => (old ? { ...old, isFavorite } : old))
    client.setQueriesData<RecipeSummaryDto[]>({ queryKey: ['recipes', 'list'] }, (old) =>
      old?.map((r) => (r.id === id ? { ...r, isFavorite } : r)),
    )
  }
  return useMutation({
    mutationFn: ({ id, favorite }: FavoriteVars) =>
      apiFetch<void>(`/recipes/${id}/favorite`, { method: favorite ? 'PUT' : 'DELETE' }),
    onMutate: ({ id, favorite }) => patch(id, favorite),
    onError: (_error, { id, favorite }) => patch(id, !favorite),
    onSettled: () => client.invalidateQueries({ queryKey: ['recipes', 'list'] }),
  })
}

export async function uploadImage(blob: Blob, width: number, height: number): Promise<ImageDto> {
  const form = new FormData()
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
  form.append('file', blob, `fotka.${ext}`)
  form.append('width', String(width))
  form.append('height', String(height))
  return apiFetch<ImageDto>('/images', { method: 'POST', body: form })
}
