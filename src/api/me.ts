import { useQuery } from '@tanstack/vue-query'
import type { MeResponse } from '@shared/api'
import { apiFetch } from './http'

export const meQueryKey = ['me'] as const

export const useMe = () => useQuery({ queryKey: meQueryKey, queryFn: () => apiFetch<MeResponse>('/me') })
