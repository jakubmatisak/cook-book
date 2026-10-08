import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { ApiErrorBody, SharedRecipeDto } from '@shared/api'
import { t } from '@/i18n'
import { API_BASE, ApiError } from './http'

/**
 * Recept otvorený odkazom na zdieľanie. Volá sa priamo cez `fetch`, nie `apiFetch`: návštevník nie je prihlásený,
 * nemá domácnosť (`?h=`) a pri chybe ho nesmieme posielať na prihlásenie.
 */
async function fetchShared(token: string): Promise<SharedRecipeDto> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/shared/${encodeURIComponent(token)}`, { credentials: 'omit' })
  } catch {
    throw new ApiError(0, 'network_error', t('common.errors.network_error'))
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => undefined)) as ApiErrorBody | undefined
    throw new ApiError(res.status, body?.error?.code ?? `http_${res.status}`, body?.error?.message ?? '')
  }
  return res.json() as Promise<SharedRecipeDto>
}

export const useSharedRecipe = (token: MaybeRefOrGetter<string>) =>
  useQuery({
    queryKey: computed(() => ['shared', toValue(token)] as const),
    queryFn: () => fetchShared(toValue(token)),
    retry: false,
  })
