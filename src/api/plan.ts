import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationReturnType,
} from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type {
  GuestStayDto,
  PlanCopyResult,
  PlanEntryDto,
  TemplateApplyResult,
  WeekTemplateDto,
} from '@shared/api'
import type { ComposeItem } from '@shared/compose'
import type {
  ComposeApplyInputRaw,
  ComposeRequestInputRaw,
  GuestStayInput,
  PlanEntryInputRaw,
} from '@shared/schemas/plan'
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

/** Zmena jedálnička obnoví plán aj návrhy „čo uvariť dnes“. */
const invalidatePlan = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: planKeys.all }),
    client.invalidateQueries({ queryKey: ['recipes', 'suggestions'] }),
  ])

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
    onSuccess: () => invalidatePlan(client),
  })
}

export function useDeleteEntry(): UseMutationReturnType<void, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/plan/entries/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidatePlan(client),
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
    onSuccess: () => invalidatePlan(client),
  })
}

/** Vymaže všetky jedlá vybraných dní. */
export function useClearDays(): UseMutationReturnType<{ removed: number }, Error, string[], unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (dates: string[]) => apiFetch<{ removed: number }>('/plan/clear', json('POST', { dates })),
    onSuccess: () => invalidatePlan(client),
  })
}

// ─── Zostaviť jedálniček ─────────────────────────────────────────────────────

/** Návrh jedálnička pre vymaľované políčka (nič sa neukladá). */
export function useComposePlan(): UseMutationReturnType<
  ComposeItem[],
  Error,
  ComposeRequestInputRaw,
  unknown
> {
  return useMutation({
    mutationFn: (input: ComposeRequestInputRaw) =>
      apiFetch<ComposeItem[]>('/plan/compose', json('POST', input)),
  })
}

/** Uloží potvrdený návrh naraz; vráti počet uložených jedál. */
export function useApplyCompose(): UseMutationReturnType<
  { added: number },
  Error,
  ComposeApplyInputRaw,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: ComposeApplyInputRaw) =>
      apiFetch<{ added: number }>('/plan/compose/apply', json('POST', input)),
    onSuccess: () => invalidatePlan(client),
  })
}

// ─── Pobyty návštev ──────────────────────────────────────────────────────────

export const staysKey = (from: string, to: string) => ['plan', 'stays', from, to] as const

/** Pobyty návštev, ktoré sa prekrývajú so zobrazeným rozsahom dní. */
export function usePlanStays(from: MaybeRefOrGetter<string>, to: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => staysKey(toValue(from), toValue(to))),
    queryFn: () => apiFetch<GuestStayDto[]>(`/plan/stays?from=${toValue(from)}&to=${toValue(to)}`),
    placeholderData: (previous) => previous,
  })
}

/** Návšteva (jedna alebo viac osôb) na dni od – do; jedlá v týchto dňoch s ňou počítajú. */
export function useCreateStays(): UseMutationReturnType<
  GuestStayDto[],
  Error,
  Pick<GuestStayInput, 'memberIds' | 'fromDate' | 'toDate'>,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input) => apiFetch<GuestStayDto[]>('/plan/stays', json('POST', input)),
    onSuccess: () => invalidatePlan(client),
  })
}

export function useDeleteStays(): UseMutationReturnType<void, Error, string[], unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await apiFetch<void>(`/plan/stays/${id}`, { method: 'DELETE' })
    },
    onSettled: () => invalidatePlan(client),
  })
}

// ─── Šablóny týždňov ─────────────────────────────────────────────────────────

export const useTemplates = () =>
  useQuery({ queryKey: ['plan-templates'], queryFn: () => apiFetch<WeekTemplateDto[]>('/plan/templates') })

export interface SaveTemplateVars {
  name: string
  fromDate: string
}

export function useSaveTemplate(): UseMutationReturnType<WeekTemplateDto, Error, SaveTemplateVars, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (vars: SaveTemplateVars) => apiFetch<WeekTemplateDto>('/plan/templates', json('POST', vars)),
    onSuccess: () => client.invalidateQueries({ queryKey: ['plan-templates'] }),
  })
}

export interface ApplyTemplateVars {
  id: string
  toDate: string
  replace: boolean
}

export function useApplyTemplate(): UseMutationReturnType<
  TemplateApplyResult,
  Error,
  ApplyTemplateVars,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: ApplyTemplateVars) =>
      apiFetch<TemplateApplyResult>(`/plan/templates/${id}/apply`, json('POST', body)),
    onSuccess: () => invalidatePlan(client),
  })
}

export function useDeleteTemplate(): UseMutationReturnType<void, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/plan/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['plan-templates'] }),
  })
}
