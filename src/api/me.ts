import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import type { MeResponse } from '@shared/api'
import { apiFetch } from './http'

export const meQueryKey = ['me'] as const

export const useMe = () => useQuery({ queryKey: meQueryKey, queryFn: () => apiFetch<MeResponse>('/me') })

/** Vlastník aktívnej domácnosti smie meniť nastavenia, rodinu, členov a export; server to vynucuje, klient len skrýva. */
export function useIsOwner() {
  const { data } = useMe()
  return computed(() => data.value?.user.role === 'owner')
}
