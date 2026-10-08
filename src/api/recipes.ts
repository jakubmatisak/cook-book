import { useMutation, useQuery, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type {
  RecipeShareDto,
  ImageDto,
  ImportRecipeResultDto,
  RecipeDetailDto,
  RecipeListDto,
  SampleRecipesResult,
  SuggestionDto,
} from '@shared/api'
import type { SampleSet } from '@shared/data/sampleSets'
import type { SortDir, SortKey, TimeBucket } from '@shared/recipeFacets'
import type { RecipeCategory } from '@shared/recipes'
import type { RecipeInputRaw } from '@shared/schemas/recipe'
import { apiFetch } from './http'
import { addIngredientsToCache, ingredientsFromRecipe, markIngredientsStale } from './ingredientCache'

export interface RecipeFilters {
  q?: string | undefined
  category?: RecipeCategory[] | undefined
  tag?: string[] | undefined
  difficulty?: number[] | undefined
  time?: TimeBucket[] | undefined
  sort?: SortKey | undefined
  dir?: SortDir | undefined
  /** Najviac toľko chýbajúcich surovín (len s `pantry`). */
  missing?: number | undefined
  favorite?: boolean | undefined
  /** Zahrnúť aj detské recepty (inak sa v zozname skrývajú). */
  kids?: 'hide' | 'include' | 'only' | undefined
  /** Verejné recepty iných domácností v zozname. */
  public?: 'hide' | 'include' | 'only' | undefined
  /** „Čo viem uvariť“: zoradiť podľa toho, čo je doma, s chýbajúcimi ingredienciami. */
  pantry?: boolean | undefined
}

export const recipeKeys = {
  all: ['recipes'] as const,
  list: (filters: RecipeFilters) => ['recipes', 'list', filters] as const,
  detail: (id: string) => ['recipes', 'detail', id] as const,
}

function toQuery(filters: RecipeFilters): string {
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.category?.length) params.set('category', filters.category.join(','))
  if (filters.tag?.length) params.set('tag', filters.tag.join(','))
  if (filters.difficulty?.length) params.set('difficulty', filters.difficulty.join(','))
  if (filters.time?.length) params.set('time', filters.time.join(','))
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.dir) params.set('dir', filters.dir)
  if (filters.favorite) params.set('favorite', '1')
  if (filters.kids === 'include') params.set('kids', '1')
  if (filters.kids === 'only') params.set('kids', 'only')
  if (filters.public === 'include' || filters.public === 'only') params.set('public', filters.public)
  if (filters.pantry) params.set('pantry', '1')
  if (filters.pantry && filters.missing !== undefined) params.set('missing', String(filters.missing))
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function useRecipes(filters: MaybeRefOrGetter<RecipeFilters>) {
  return useQuery({
    queryKey: computed(() => recipeKeys.list(toValue(filters))),
    queryFn: () => apiFetch<RecipeListDto>(`/recipes${toQuery(toValue(filters))}`),
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
      // Nové suroviny z receptu sa doplnia do pamäte z odpovede, zoznam sa nesťahuje znova.
      addIngredientsToCache(client, ingredientsFromRecipe(detail))
      void client.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}

/** Pridá ukážkové recepty po dávkach (server má limit dopytov) a vráti, koľko ich pribudlo. */
export function useAddSampleRecipes(
  set: SampleSet = 'basic',
): UseMutationReturnType<number, Error, void, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      let total = 0
      // Najviac 21 receptov po štyroch, poistka proti nekonečnému cyklu.
      for (let batch = 0; batch < 10; batch++) {
        const result = await apiFetch<SampleRecipesResult>(`/recipes/samples?set=${set}`, { method: 'POST' })
        total += result.added
        if (result.remaining === 0 || result.added === 0) break
      }
      return total
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['recipes', 'list'] })
      void client.invalidateQueries({ queryKey: ['tags'] })
      markIngredientsStale(client)
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
      markIngredientsStale(client)
    },
  })
}

/** Zapne zdieľanie receptu odkazom (`/s/<kód>`); detail si kód hneď zapamätá. */
export function useShareRecipe(): UseMutationReturnType<RecipeShareDto, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<RecipeShareDto>(`/recipes/${id}/share`, { method: 'POST' }),
    onSuccess: (share, id) =>
      client.setQueryData<RecipeDetailDto>(recipeKeys.detail(id), (old) =>
        old ? { ...old, shareToken: share.token } : old,
      ),
  })
}

/** Zastaví zdieľanie: starý odkaz prestane fungovať. */
export function useUnshareRecipe(): UseMutationReturnType<void, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/recipes/${id}/share`, { method: 'DELETE' }),
    onSuccess: (_data, id) =>
      client.setQueryData<RecipeDetailDto>(recipeKeys.detail(id), (old) =>
        old ? { ...old, shareToken: null } : old,
      ),
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
    client.setQueriesData<RecipeListDto>({ queryKey: ['recipes', 'list'] }, (old) =>
      old ? { ...old, items: old.items.map((r) => (r.id === id ? { ...r, isFavorite } : r)) } : old,
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

/** Načíta recept zo stránky na webe; nič sa neukladá, výsledok sa len predvyplní do editora. */
export function useImportRecipe(): UseMutationReturnType<ImportRecipeResultDto, Error, string, unknown> {
  return useMutation({
    mutationFn: (url: string) =>
      apiFetch<ImportRecipeResultDto>('/recipes/import', { method: 'POST', body: JSON.stringify({ url }) }),
  })
}

/** Návrhy „čo uvariť dnes“ pre daný deň (zmena plánu aj špajze ich obnoví). */
export function useSuggestions(date: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => ['recipes', 'suggestions', toValue(date)] as const),
    queryFn: () => apiFetch<SuggestionDto[]>(`/recipes/suggestions?date=${toValue(date)}`),
    staleTime: 60_000,
  })
}
