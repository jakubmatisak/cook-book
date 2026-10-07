import { useMutation, useQuery, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import type {
  IngredientDto,
  PantryDto,
  PantryItemDto,
  ShopCategoryDto,
  StapleDto,
  StarterIngredientsResult,
  StarterStatusDto,
  TagDto,
} from '@shared/api'
import type { TagInput } from '@shared/schemas/recipe'
import type { UnitCode } from '@shared/units'
import { computed } from 'vue'
import { shopCategoryName } from '@/i18n/defaults'
import { apiFetch } from './http'
import { addIngredientsToCache, ingredientFromStaple, INGREDIENTS_KEY } from './ingredientCache'

/**
 * Zoznam surovín: stiahne sa raz za beh aplikácie a ostáva v pamäti (žiadne obnovenie pri okne,
 * zaostrení ani pripojení). Nové suroviny sa doplnia z odpovedí servera, pozri `ingredientCache`.
 * `refreshCounts` (stránka Ingrediencie): po zmene v receptoch sa zoznam raz načíta znova,
 * aby sedeli počty použití.
 */
export const useIngredients = (options: { refreshCounts?: boolean } = {}) =>
  useQuery({
    queryKey: INGREDIENTS_KEY,
    queryFn: () => apiFetch<IngredientDto[]>('/ingredients'),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: options.refreshCounts ?? false,
  })

export const useTags = () =>
  useQuery({ queryKey: ['tags'], queryFn: () => apiFetch<TagDto[]>('/tags'), staleTime: 60_000 })

/** Kategórie obchodu; predvolené názvy sa zobrazujú v jazyku aplikácie (premenované ostávajú ako zadané). */
export function useShopCategories() {
  const query = useQuery({
    queryKey: ['shop-categories'],
    queryFn: () => apiFetch<ShopCategoryDto[]>('/shop-categories'),
    staleTime: 5 * 60_000,
  })
  const data = computed(() => query.data.value?.map((c) => ({ ...c, name: shopCategoryName(c.name) })))
  return { ...query, data }
}

/** Vytvorí novú ingredienciu (ručne zo Špajze); nová sa rovno doplní do pamäte zoznamu surovín. */
export function useCreateIngredient(): UseMutationReturnType<
  IngredientDto,
  Error,
  { name: string; shopCategoryId: string | null; defaultUnit: UnitCode | null },
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input) =>
      apiFetch<IngredientDto>('/ingredients', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (created) => {
      addIngredientsToCache(client, [created])
      void client.invalidateQueries({ queryKey: [...INGREDIENTS_KEY, 'starter-status'] })
    },
  })
}

/** Koľko základných surovín chýba (tlačidlo „Pridať základné suroviny“ dáva zmysel, len keď niečo chýba). */
export const useStarterStatus = () =>
  useQuery({
    queryKey: [...INGREDIENTS_KEY, 'starter-status'],
    queryFn: () => apiFetch<StarterStatusDto>('/ingredients/starter'),
    staleTime: 0,
  })

/** Pridá základné suroviny; odpoveď nesie len pridané, takže sa zoznam nesťahuje znova. */
export function useAddStarterIngredients(): UseMutationReturnType<
  StarterIngredientsResult,
  Error,
  void,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<StarterIngredientsResult>('/ingredients/starter', { method: 'POST' }),
    onSuccess: (result) => {
      addIngredientsToCache(client, result.items)
      void client.invalidateQueries({ queryKey: [...INGREDIENTS_KEY, 'starter-status'] })
    },
  })
}

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
      client.setQueryData<IngredientDto[]>(INGREDIENTS_KEY, (old) =>
        old?.map((i) => (i.id === updated.id ? updated : i)),
      )
      // Názov je aj v receptoch, špajzi a stálych položkách.
      void client.invalidateQueries({ queryKey: ['recipes'] })
      void client.invalidateQueries({ queryKey: ['pantry'] })
      void client.invalidateQueries({ queryKey: ['staples'] })
    },
  })
}

/** Zmaže ingredienciu zo zoznamu (aj zo špajze a stálych položiek); použitú v receptoch server odmietne. */
export function useDeleteIngredient(): UseMutationReturnType<void, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/ingredients/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      client.setQueryData<IngredientDto[]>(INGREDIENTS_KEY, (old) => old?.filter((i) => i.id !== id))
      void client.invalidateQueries({ queryKey: ['pantry'] })
      void client.invalidateQueries({ queryKey: ['staples'] })
      void client.invalidateQueries({ queryKey: ['me'] })
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

const PANTRY_TOGGLE_KEY = ['pantry', 'toggle'] as const

/** Označí ingredienciu „mám doma“ hneď v UI, server sa dobehne. */
export function useTogglePantry(): UseMutationReturnType<void, Error, PantryToggleVars, void> {
  const client = useQueryClient()
  const patch = (ingredientId: string, inPantry: boolean) =>
    client.setQueryData<PantryDto>(['pantry'], (old) => {
      const ids = new Set(old?.ingredientIds ?? [])
      if (inPantry) ids.add(ingredientId)
      else ids.delete(ingredientId)
      const items = old?.items ?? []
      return {
        ingredientIds: [...ids],
        items: inPantry ? items : items.filter((i) => i.ingredientId !== ingredientId),
      }
    })
  return useMutation({
    mutationKey: PANTRY_TOGGLE_KEY,
    mutationFn: ({ ingredientId, inPantry }: PantryToggleVars) =>
      apiFetch<void>(`/pantry/${ingredientId}`, { method: inPantry ? 'PUT' : 'DELETE' }),
    onMutate: async ({ ingredientId, inPantry }) => {
      // Prebiehajúce načítanie špajze by vrátilo starý stav a zaškrtnutie by na chvíľu zmizlo.
      await client.cancelQueries({ queryKey: ['pantry'] })
      patch(ingredientId, inPantry)
    },
    onError: (_e, { ingredientId, inPantry }) => patch(ingredientId, !inPantry),
    onSettled: () => {
      // Pri rýchlom zaškrtávaní sa špajza načíta až po poslednej zmene; inak by medzivýsledok zo servera
      // odškrtol veci, ktoré server ešte len ukladá.
      if (client.isMutating({ mutationKey: PANTRY_TOGGLE_KEY }) > 1) return
      void client.invalidateQueries({ queryKey: ['pantry'] })
      void client.invalidateQueries({ queryKey: ['recipes'] })
    },
  })
}

export interface PantryItemInput {
  quantity: number | null
  unit: UnitCode | null
  expiresOn: string | null
  location: string | null
}

export interface SavePantryItemVars {
  ingredientId: string
  input: PantryItemInput
}

/** Uloží množstvo, trvanlivosť a miesto zásoby (a ingredienciu tým označí ako doma). */
export function useSavePantryItem(): UseMutationReturnType<
  PantryItemDto,
  Error,
  SavePantryItemVars,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ ingredientId, input }: SavePantryItemVars) =>
      apiFetch<PantryItemDto>(`/pantry/${ingredientId}`, { method: 'PUT', body: JSON.stringify(input) }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['pantry'] })
      void client.invalidateQueries({ queryKey: ['recipes'] })
    },
  })
}

// ─── Stále položky nákupu ────────────────────────────────────────────────────

export const useStaples = () =>
  useQuery({ queryKey: ['staples'], queryFn: () => apiFetch<StapleDto[]>('/staples') })

export interface StapleInput {
  name: string
  quantity: number | null
  unit: UnitCode | null
  everyNWeeks: number
}

export function useCreateStaple(): UseMutationReturnType<StapleDto, Error, StapleInput, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: StapleInput) =>
      apiFetch<StapleDto>('/staples', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (staple) => addIngredientsToCache(client, [ingredientFromStaple(staple)]),
    onSettled: () => void client.invalidateQueries({ queryKey: ['staples'] }),
  })
}

export interface UpdateStapleVars {
  id: string
  patch: Partial<Omit<StapleInput, 'name'>>
}

export function useUpdateStaple(): UseMutationReturnType<StapleDto, Error, UpdateStapleVars, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: UpdateStapleVars) =>
      apiFetch<StapleDto>(`/staples/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSettled: () => void client.invalidateQueries({ queryKey: ['staples'] }),
  })
}

export function useDeleteStaple(): UseMutationReturnType<void, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/staples/${id}`, { method: 'DELETE' }),
    onSettled: () => void client.invalidateQueries({ queryKey: ['staples'] }),
  })
}
