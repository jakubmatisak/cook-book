import { useMutation, useQuery, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { PlanCopyResult, PlanEntryDto } from '@shared/api'
import type { PlanEntryInputRaw } from '@shared/schemas/plan'
import { apiFetch } from './http'

export const planKeys = {
  all: ['plan'] as const,
  range: (from: string, to: string) => ['plan', from, to] as const,
}

export function usePlan(from: MaybeRefOrGetter<string>, to: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => planKeys.range(toValue(from), toValue(to))),
    queryFn: () => apiFetch<PlanEntryDto[]>(`/plan?from=${toValue(from)}&to=${toValue(to)}`),
    placeholderData: (previous) => previous,
  })
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

export interface SaveEntryVars {
  id?: string
  input: PlanEntryInputRaw
}

export function useSaveEntry(): UseMutationReturnType<PlanEntryDto, Error, SaveEntryVars, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: SaveEntryVars) =>
      apiFetch<PlanEntryDto>(id ? `/plan/entries/${id}` : '/plan/entries', json(id ? 'PUT' : 'POST', input)),
    onSuccess: () => client.invalidateQueries({ queryKey: planKeys.all }),
  })
}

export function useDeleteEntry(): UseMutationReturnType<void, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/plan/entries/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: planKeys.all }),
  })
}

export interface CopyPlanVars {
  fromDate: string
  toDate: string
  days?: number
  replace?: boolean
}

export function useCopyPlan(): UseMutationReturnType<PlanCopyResult, Error, CopyPlanVars, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (vars: CopyPlanVars) => apiFetch<PlanCopyResult>('/plan/copy', json('POST', vars)),
    onSuccess: () => client.invalidateQueries({ queryKey: planKeys.all }),
  })
}
