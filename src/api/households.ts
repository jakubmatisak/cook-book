import { useMutation, useQuery, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import type { HouseholdMemberDto, HouseholdSummaryDto } from '@shared/api'
import type { HouseholdRole } from '@shared/family'
import { apiFetch } from './http'

export const householdsKey = ['households'] as const
export const householdMembersKey = ['household', 'members'] as const

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})

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
    mutationFn: (name: string) => apiFetch<HouseholdSummaryDto>('/households', json('POST', { name })),
    onSuccess: () => client.invalidateQueries({ queryKey: householdsKey }),
  })
}

/** Členovia (prihlasovacie účty) aktívnej domácnosti; čítať môže každý člen. */
export const useHouseholdMembers = () =>
  useQuery({
    queryKey: householdMembersKey,
    queryFn: () => apiFetch<HouseholdMemberDto[]>('/household/members'),
  })

export interface InviteVars {
  email: string
  role: HouseholdRole
}

export function useInviteMember(): UseMutationReturnType<HouseholdMemberDto, Error, InviteVars, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (vars: InviteVars) => apiFetch<HouseholdMemberDto>('/household/members', json('POST', vars)),
    onSuccess: () => client.invalidateQueries({ queryKey: householdMembersKey }),
  })
}

export interface ChangeRoleVars {
  userId: string
  role: HouseholdRole
}

export function useChangeMemberRole(): UseMutationReturnType<
  HouseholdMemberDto,
  Error,
  ChangeRoleVars,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: ChangeRoleVars) =>
      apiFetch<HouseholdMemberDto>(`/household/members/${userId}`, json('PUT', { role })),
    onSettled: () => client.invalidateQueries({ queryKey: householdMembersKey }),
  })
}

export function useRemoveMember(): UseMutationReturnType<void, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => apiFetch<void>(`/household/members/${userId}`, json('DELETE')),
    onSuccess: () => client.invalidateQueries({ queryKey: householdMembersKey }),
  })
}

export function useRenameHousehold(): UseMutationReturnType<
  { id: string; name: string },
  Error,
  string,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => apiFetch<{ id: string; name: string }>('/household', json('PUT', { name })),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['me'] }),
        client.invalidateQueries({ queryKey: householdsKey }),
      ]),
  })
}
