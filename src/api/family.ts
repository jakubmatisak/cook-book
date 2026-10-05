import { useMutation, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import type { FamilyMemberDto, HouseholdSettings, MealSlotDto } from '@shared/api'
import type {
  MemberInputRaw,
  MemberPreferencesInput,
  SettingsUpdate,
  SlotUpdate,
} from '@shared/schemas/family'
import { apiFetch } from './http'
import { meQueryKey } from './me'

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

export interface SaveMemberVars {
  id?: string
  input: MemberInputRaw
}

/** Členovia, sloty a nastavenia sú súčasťou `/me`, preto každá zmena obnoví `me`. */
export function useSaveMember(): UseMutationReturnType<FamilyMemberDto, Error, SaveMemberVars, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: SaveMemberVars) =>
      apiFetch<FamilyMemberDto>(id ? `/members/${id}` : '/members', json(id ? 'PUT' : 'POST', input)),
    onSuccess: () => client.invalidateQueries({ queryKey: meQueryKey }),
  })
}

export interface SavePreferencesVars extends MemberPreferencesInput {
  id: string
}

/** Alergie, averzie a diéty člena; mení aj upozornenia v jedálničku, preto obnoví aj plán. */
export function useSaveMemberPreferences(): UseMutationReturnType<
  FamilyMemberDto,
  Error,
  SavePreferencesVars,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: SavePreferencesVars) =>
      apiFetch<FamilyMemberDto>(`/members/${id}/preferences`, json('PUT', body)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['plan'] })
      return client.invalidateQueries({ queryKey: meQueryKey })
    },
  })
}

export function useDeleteMember(): UseMutationReturnType<void, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/members/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: meQueryKey }),
  })
}

export interface UpdateSlotVars {
  id: string
  patch: SlotUpdate
}

export function useUpdateSlot(): UseMutationReturnType<MealSlotDto, Error, UpdateSlotVars, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: UpdateSlotVars) => apiFetch<MealSlotDto>(`/slots/${id}`, json('PUT', patch)),
    onSuccess: () => client.invalidateQueries({ queryKey: meQueryKey }),
  })
}

export function useUpdateSettings(): UseMutationReturnType<
  HouseholdSettings,
  Error,
  SettingsUpdate,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: SettingsUpdate) => apiFetch<HouseholdSettings>('/settings', json('PUT', patch)),
    onSuccess: () => client.invalidateQueries({ queryKey: meQueryKey }),
  })
}
