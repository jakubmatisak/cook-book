import { useMutation, useQuery, useQueryClient, type UseMutationReturnType } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { GenerateResult, ShoppingItemDto, ShoppingListDto } from '@shared/api'
import type { ItemCreateInput } from '@shared/schemas/shopping'
import { createOfflineQueue, idbQueueStorage, type QueuedChange } from '@/features/shopping/offlineQueue'
import { ApiError, apiFetch } from './http'

export const shoppingKeys = {
  lists: ['shopping', 'lists'] as const,
  items: (listId: string) => ['shopping', 'items', listId] as const,
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})

export const offlineQueue = createOfflineQueue(idbQueueStorage, (changes: QueuedChange[]) =>
  apiFetch('/shopping/items/batch', json('POST', { changes })),
)

export const useShoppingLists = () =>
  useQuery({
    queryKey: shoppingKeys.lists,
    queryFn: () => apiFetch<ShoppingListDto[]>('/shopping/lists'),
    staleTime: 5 * 60_000,
  })

/** Položky zoznamu; kým je stránka viditeľná, obnovujú sa každých 5 s (zmeny od druhého človeka). */
export function useShoppingItems(listId: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: computed(() => shoppingKeys.items(toValue(listId) ?? '')),
    queryFn: () => apiFetch<ShoppingItemDto[]>(`/shopping/lists/${toValue(listId)}/items`),
    enabled: computed(() => Boolean(toValue(listId))),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  })
}

export interface ToggleVars {
  item: ShoppingItemDto
  isChecked: boolean
}

/** Odškrtnutie hneď v UI; bez signálu sa zmena uloží do fronty a odošle po pripojení. */
export function useToggleItem(): UseMutationReturnType<'sent' | 'queued', Error, ToggleVars, void> {
  const client = useQueryClient()
  const patch = (item: ShoppingItemDto, isChecked: boolean) =>
    client.setQueryData<ShoppingItemDto[]>(shoppingKeys.items(item.listId), (old) =>
      old?.map((i) =>
        i.id === item.id ? { ...i, isChecked, checkedAt: isChecked ? new Date().toISOString() : null } : i,
      ),
    )
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ item, isChecked }: ToggleVars) => {
      try {
        await apiFetch(`/shopping/items/${item.id}`, json('PATCH', { isChecked }))
        return 'sent' as const
      } catch (error) {
        if (error instanceof ApiError && error.code === 'network_error') {
          await offlineQueue.enqueue({ id: item.id, isChecked, at: new Date().toISOString() })
          return 'queued' as const
        }
        throw error
      }
    },
    onMutate: async ({ item, isChecked }) => {
      await client.cancelQueries({ queryKey: shoppingKeys.items(item.listId) })
      patch(item, isChecked)
    },
    onError: (_error, { item, isChecked }) => patch(item, !isChecked),
  })
}

const invalidateItems = (client: ReturnType<typeof useQueryClient>, listId: string) =>
  client.invalidateQueries({ queryKey: shoppingKeys.items(listId) })

export interface AddItemVars {
  listId: string
  input: ItemCreateInput
}

export function useAddItem(): UseMutationReturnType<ShoppingItemDto, Error, AddItemVars, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ listId, input }: AddItemVars) =>
      apiFetch<ShoppingItemDto>(`/shopping/lists/${listId}/items`, json('POST', input)),
    onSuccess: (_item, { listId }) => invalidateItems(client, listId),
  })
}

export interface UpdateItemVars {
  item: ShoppingItemDto
  patch: Partial<Pick<ShoppingItemDto, 'name' | 'quantity' | 'unit' | 'shopCategoryId'>>
}

export function useUpdateItem(): UseMutationReturnType<ShoppingItemDto, Error, UpdateItemVars, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ item, patch }: UpdateItemVars) =>
      apiFetch<ShoppingItemDto>(`/shopping/items/${item.id}`, json('PATCH', patch)),
    onSuccess: (_item, { item }) => invalidateItems(client, item.listId),
  })
}

export function useDeleteItem(): UseMutationReturnType<void, Error, ShoppingItemDto, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (item: ShoppingItemDto) => apiFetch<void>(`/shopping/items/${item.id}`, { method: 'DELETE' }),
    onSuccess: (_r, item) => invalidateItems(client, item.listId),
  })
}

export function useClearChecked(): UseMutationReturnType<{ removed: number }, Error, string, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (listId: string) =>
      apiFetch<{ removed: number }>(`/shopping/lists/${listId}/clear-checked`, { method: 'POST' }),
    onSuccess: (_r, listId) => invalidateItems(client, listId),
  })
}

export interface GenerateVars {
  listId: string
  from: string
  to: string
}

export function useGenerateList(): UseMutationReturnType<GenerateResult, Error, GenerateVars, unknown> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ listId, from, to }: GenerateVars) =>
      apiFetch<GenerateResult>(`/shopping/lists/${listId}/generate`, json('POST', { from, to })),
    onSuccess: (_r, { listId }) => invalidateItems(client, listId),
  })
}
