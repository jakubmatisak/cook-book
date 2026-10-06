import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { vi } from 'vitest'
import type { Plugin } from 'vue'
import type { HouseholdMemberDto, MeResponse } from '@shared/api'
import type { HouseholdRole } from '@shared/family'
import { createAppVuetify } from '@/plugins/vuetify'

export const me = (role: HouseholdRole, isAdmin = false): MeResponse => ({
  user: { id: 'u1', email: 'ja@example.com', name: 'ja', memberId: null, role, isAdmin },
  household: { id: 'h1', name: 'Doma' },
  households: [{ id: 'h1', name: 'Doma', role }],
  userSettings: {},
  members: [],
  slots: [
    { id: 's1', name: 'Obed', sortOrder: 0, isEnabled: true, defaultTime: '12:00' },
    { id: 's2', name: 'Večera', sortOrder: 1, isEnabled: true, defaultTime: '18:00' },
  ],
  settings: {
    weekStartsOn: 1,
    childPortionFactor: 0.5,
    starterIngredientsAdded: true,
    ignoreSpicesInPantry: false,
  },
})

export const member = (over: Partial<HouseholdMemberDto> & { email: string }): HouseholdMemberDto => ({
  userId: over.email,
  name: over.email.split('@')[0]!,
  role: 'member',
  lastLoginAt: null,
  locked: false,
  ...over,
})

export interface StubCall {
  method: string
  path: string
  body: unknown
}

/** Falošné API: odpovede podľa cesty (bez /api/v1 a ?h=), zaznamenáva volania. */
export function stubApi(routes: Record<string, unknown | ((call: StubCall) => Response)>) {
  const calls: StubCall[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const path = String(url).replace('/api/v1', '').split('?')[0]!
      const call: StubCall = {
        method: init?.method ?? 'GET',
        path,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      }
      calls.push(call)
      const handler = routes[`${call.method} ${path}`] ?? routes[path]
      if (typeof handler === 'function') return Promise.resolve((handler as (c: StubCall) => Response)(call))
      if (handler === undefined)
        return Promise.resolve(jsonResponse({ error: { code: 'x', message: path } }, 404))
      return Promise.resolve(jsonResponse(handler))
    }),
  )
  return calls
}

export const jsonResponse = (body: unknown, status = 200) =>
  status === 204
    ? new Response(null, { status })
    : new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export const mountPlugins = (): (Plugin | [Plugin, ...unknown[]])[] => [
  createAppVuetify(),
  [VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }],
]
