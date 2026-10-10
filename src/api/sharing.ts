import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationReturnType,
} from '@tanstack/vue-query'
import type {
  ContactDto,
  CreateSharesResult,
  IncomingShareDto,
  OutgoingShareDto,
  RecipeDetailDto,
  ShareNoticeDto,
} from '@shared/api'
import type { RecipeCategory } from '@shared/recipes'
import type { ShareKind } from '@shared/sharing'
import { apiFetch } from './http'
import { recipeKeys } from './recipes'

export const sharingKeys = {
  all: ['sharing'] as const,
  outgoing: ['sharing', 'outgoing'] as const,
  incoming: ['sharing', 'incoming'] as const,
  notices: ['sharing', 'notices'] as const,
  contacts: ['contacts'] as const,
}

/** Po každej zmene zdieľania sa obnovia prehľady, upozornenia a zoznam receptov (filtre Zdieľam / so mnou). */
function refresh(client: QueryClient) {
  void client.invalidateQueries({ queryKey: sharingKeys.all })
  void client.invalidateQueries({ queryKey: ['recipes', 'list'] })
  void client.invalidateQueries({ queryKey: ['recipes', 'detail'] })
  void client.invalidateQueries({ queryKey: ['public'] })
}

const post = (path: string, body?: unknown) =>
  apiFetch<{ ok: true }>(`/sharing${path}`, {
    method: 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

export const useOutgoingShares = () =>
  useQuery({
    queryKey: sharingKeys.outgoing,
    queryFn: () => apiFetch<OutgoingShareDto[]>('/sharing/outgoing'),
  })

export const useIncomingShares = () =>
  useQuery({
    queryKey: sharingKeys.incoming,
    queryFn: () => apiFetch<IncomingShareDto[]>('/sharing/incoming'),
  })

export const useShareNotices = () =>
  useQuery({ queryKey: sharingKeys.notices, queryFn: () => apiFetch<ShareNoticeDto[]>('/sharing/notices') })

export interface CreateSharesVars {
  emails: string[]
  kind: ShareKind
  recipeIds?: string[]
  category?: RecipeCategory
  tagId?: string
  message?: string | null
}

export function useCreateShares(): UseMutationReturnType<
  CreateSharesResult,
  Error,
  CreateSharesVars,
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (vars: CreateSharesVars) =>
      apiFetch<CreateSharesResult>('/sharing', { method: 'POST', body: JSON.stringify(vars) }),
    onSuccess: () => {
      refresh(client)
      void client.invalidateQueries({ queryKey: sharingKeys.contacts })
    },
  })
}

/** Mutácia nad jednou ponukou (`/sharing/:id/<akcia>`); po nej sa obnovia prehľady a recepty. */
function useShareAction<V extends { id: string }>(action: string, body?: (vars: V) => unknown) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (vars: V) => post(`/${vars.id}/${action}`, body?.(vars)),
    onSuccess: () => refresh(client),
  })
}

type ShareMutation<V> = UseMutationReturnType<{ ok: true }, Error, V, unknown>
type IdVars = { id: string }
type AcceptVars = { id: string; recipeIds?: string[] }
type ItemsVars = { id: string; recipeIds: string[] }

export const useAcceptShare = (): ShareMutation<AcceptVars> =>
  useShareAction<AcceptVars>('accept', (v) => (v.recipeIds ? { recipeIds: v.recipeIds } : undefined))
export const useDeclineShare = (): ShareMutation<IdVars> => useShareAction<IdVars>('decline')
export const useLeaveShare = (): ShareMutation<IdVars> => useShareAction<IdVars>('leave')
export const useRevokeShare = (): ShareMutation<IdVars> => useShareAction<IdVars>('revoke')
export const useMarkShareSeen = (): ShareMutation<IdVars> => useShareAction<IdVars>('seen')
export const useRemoveShareItems = (): ShareMutation<ItemsVars> =>
  useShareAction<ItemsVars>('items/remove', (v) => ({ recipeIds: v.recipeIds }))

/** Skryje upozornenie, že sa originál kópie zmenil. */
export function useDismissNotice(): UseMutationReturnType<{ ok: true }, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (recipeId: string) => post('/notices/dismiss', { recipeId }),
    onSuccess: () => void client.invalidateQueries({ queryKey: sharingKeys.notices }),
  })
}

/** Nahradí vlastnú kópiu aktuálnou verziou originálu. */
export function useReplaceFromSource(): UseMutationReturnType<RecipeDetailDto, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<RecipeDetailDto>(`/recipes/${id}/replace-from-source`, { method: 'POST' }),
    onSuccess: (recipe) => {
      client.setQueryData(recipeKeys.detail(recipe.id), recipe)
      refresh(client)
    },
  })
}

export const useContacts = () =>
  useQuery({ queryKey: sharingKeys.contacts, queryFn: () => apiFetch<ContactDto[]>('/contacts') })

export function useRenameContact(): UseMutationReturnType<
  { ok: true },
  Error,
  { id: string; name: string | null },
  unknown
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string | null }) =>
      apiFetch<{ ok: true }>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: sharingKeys.contacts })
      refresh(client)
    },
  })
}

export function useDeleteContact(): UseMutationReturnType<void, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/contacts/${id}`, { method: 'DELETE' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: sharingKeys.contacts }),
  })
}
