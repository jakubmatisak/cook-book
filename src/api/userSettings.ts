import { useMutation, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import type { MeResponse } from '@shared/api'
import type { UserSettingsUpdate } from '@shared/schemas/userSettings'
import type { UserSettingsDto } from '@shared/userSettings'
import { apiFetch } from './http'
import { meQueryKey } from './me'

/** Uloží nastavenia človeka (`null` kľúč vymaže) a hneď ich premietne do načítaného `/me`. */
export function useSaveUserSettings(): UseMutationReturnType<
  UserSettingsDto,
  Error,
  UserSettingsUpdate,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: UserSettingsUpdate) =>
      apiFetch<UserSettingsDto>('/me/settings', { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: (settings) =>
      client.setQueryData<MeResponse>(meQueryKey, (old) => (old ? { ...old, userSettings: settings } : old)),
  })
}
