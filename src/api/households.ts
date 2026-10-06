import { useMutation, useQuery, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import type { HouseholdSummaryDto } from '@shared/api'
import { apiFetch } from './http'

export const householdsKey = ['households'] as const

/** Domácnosti prihláseného používateľa; volá sa bez výberu domácnosti. */
export const useHouseholds = () =>
  useQuery({
    queryKey: householdsKey,
    queryFn: () => apiFetch<HouseholdSummaryDto[]>('/households'),
    staleTime: 60_000,
  })

/** Založí ďalšiu domácnosť (len správca aplikácie). */
export function useCreateHousehold(): UseMutationReturnType<HouseholdSummaryDto, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<HouseholdSummaryDto>('/households', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: householdsKey }),
  })
}
