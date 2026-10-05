import { QueryClient, type VueQueryPluginOptions } from '@tanstack/vue-query'
import { ApiError } from '@/api/http'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Aj bez signálu sa skúsi načítať – service worker má posledné dáta v cache.
        networkMode: 'offlineFirst',
        // Chyby 4xx sa opakovaním neopravia (okrem 408 a 429).
        retry: (failureCount, error) => {
          const status = error instanceof ApiError ? error.status : (error as { status?: number }).status
          if (status !== undefined && status >= 400 && status < 500) {
            return (status === 408 || status === 429) && failureCount < 2
          }
          return failureCount < 2
        },
      },
      // Úpravy bez signálu čakajú a odošlú sa po pripojení, namiesto zlyhania.
      mutations: { networkMode: 'online' },
    },
  })
}

export const queryPluginOptions = (): VueQueryPluginOptions => ({ queryClient: createQueryClient() })
