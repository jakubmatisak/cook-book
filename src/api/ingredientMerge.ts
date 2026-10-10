import { useMutation, useQuery, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { UnitCode } from '@shared/units'
import { apiFetch } from './http'

const IGNORED_KEY = ['ingredients', 'merge-ignored'] as const

/** Návrhy na zlúčenie, ktoré domácnosť ignoruje. */
export const useMergeIgnored = () =>
  useQuery({ queryKey: IGNORED_KEY, queryFn: () => apiFetch<string[]>('/ingredients/merge-ignored') })

/** Zapamätá si, že tieto ingrediencie domácnosť zlúčiť nechce. */
export function useIgnoreMergeSuggestion(): UseMutationReturnType<{ ok: true }, Error, string[], unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ ok: true }>('/ingredients/merge-ignored', { method: 'POST', body: JSON.stringify({ ids }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: IGNORED_KEY }),
  })
}

/** V akých jednotkách sa ingrediencie používajú (pred zlúčením). */
export const useIngredientUnits = (ids: MaybeRefOrGetter<string[]>, enabled: MaybeRefOrGetter<boolean>) =>
  useQuery({
    queryKey: computed(() => ['ingredients', 'units', [...toValue(ids)].sort()]),
    // Server berie najviac 50 ID naraz – viac sa načíta po dávkach.
    queryFn: async () => {
      const all = toValue(ids)
      const parts: Record<string, UnitCode[]>[] = []
      for (let i = 0; i < all.length; i += 50) {
        parts.push(
          await apiFetch<Record<string, UnitCode[]>>(
            `/ingredients/units?ids=${encodeURIComponent(all.slice(i, i + 50).join(','))}`,
          ),
        )
      }
      return Object.assign({}, ...parts) as Record<string, UnitCode[]>
    },
    enabled: computed(() => toValue(enabled) && toValue(ids).length > 1),
    staleTime: 0,
  })
