import { QueryClient, type VueQueryPluginOptions } from '@tanstack/vue-query'
import { ApiError } from '@/api/http'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Chyby 4xx sa opakovaním neopravia (okrem 408 a 429).
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            return (error.status === 408 || error.status === 429) && failureCount < 2
          }
          return failureCount < 2
        },
      },
    },
  })
}

export const queryPluginOptions = (): VueQueryPluginOptions => ({ queryClient: createQueryClient() })
