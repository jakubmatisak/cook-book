import { describe, expect, it, vi } from 'vitest'
import {
  apiFetch,
  ApiError,
  createSessionExpiredHandler,
  filenameFromDisposition,
  RELOGIN_PATH,
} from '@/api/http'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('apiFetch', () => {
  it('pridá /api/v1 a vráti JSON', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(200, { ok: true }))
    await expect(apiFetch('/me', undefined, { fetchFn })).resolves.toEqual({ ok: true })
    expect(fetchFn.mock.calls[0]![0]).toBe('/api/v1/me')
  })

  it('chybu API prevedie na ApiError s kódom a správou', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(json(403, { error: { code: 'forbidden', message: 'Nemáš prístup' } }))
    await expect(apiFetch('/me', undefined, { fetchFn })).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
      message: 'Nemáš prístup',
    })
  })

  it('pri 401 zavolá onUnauthorized', async () => {
    const onUnauthorized = vi.fn()
    const fetchFn = vi.fn().mockResolvedValue(json(401, { error: { code: 'unauthorized', message: 'x' } }))
    await expect(apiFetch('/me', undefined, { fetchFn, onUnauthorized })).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('odpoveď bez JSON (napr. prihlasovacia stránka Access) je ApiError, nie pád parsera', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      )
    await expect(apiFetch('/me', undefined, { fetchFn })).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('chybová odpoveď bez JSON tela má generický kód podľa stavu', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 }))
    await expect(apiFetch('/me', undefined, { fetchFn })).rejects.toMatchObject({
      status: 502,
      code: 'http_502',
    })
  })

  it('výpadok siete je ApiError network_error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiFetch('/me', undefined, { fetchFn })).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
    })
  })
})

describe('filenameFromDisposition', () => {
  it('vytiahne názov súboru alebo vráti náhradný', () => {
    expect(filenameFromDisposition('attachment; filename="kniha-2026-10-05.json"', 'x.json')).toBe(
      'kniha-2026-10-05.json',
    )
    expect(filenameFromDisposition(null, 'x.json')).toBe('x.json')
    expect(filenameFromDisposition('attachment', 'x.json')).toBe('x.json')
  })
})

describe('vypršané prihlásenie Cloudflare Access', () => {
  it('API volá s redirect: manual, aby presmerovanie na Access nebolo výpadkom siete', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(200, { ok: true }))
    await apiFetch('/me', undefined, { fetchFn })
    expect(fetchFn.mock.calls[0]![1]).toMatchObject({ redirect: 'manual' })
  })

  it('presmerovanie (opaqueredirect) je session_expired a zavolá onUnauthorized', async () => {
    const redirect = {
      type: 'opaqueredirect',
      status: 0,
      ok: false,
      headers: new Headers(),
    } as unknown as Response
    const fetchFn = vi.fn().mockResolvedValue(redirect)
    const onUnauthorized = vi.fn()
    await expect(apiFetch('/me', undefined, { fetchFn, onUnauthorized })).rejects.toMatchObject({
      code: 'session_expired',
    })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
})

describe('createSessionExpiredHandler', () => {
  function setup() {
    let now = 1_000_000
    const store = new Map<string, string>()
    const navigate = vi.fn()
    const handler = createSessionExpiredHandler({
      navigate,
      now: () => now,
      storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
    })
    return { handler, navigate, advance: (ms: number) => (now += ms) }
  }

  it('presmeruje na prihlásenie najviac raz za 30 sekúnd, aby nevznikla slučka', () => {
    const { handler, navigate, advance } = setup()
    handler()
    handler()
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith(RELOGIN_PATH)
    advance(31_000)
    handler()
    expect(navigate).toHaveBeenCalledTimes(2)
  })

  it('nespadne, keď úložisko prehliadača nie je dostupné', () => {
    const navigate = vi.fn()
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    const handler = createSessionExpiredHandler({ navigate, now: () => 0, storage: broken })
    expect(() => handler()).not.toThrow()
    expect(navigate).toHaveBeenCalledOnce()
  })
})

describe('apiFetch – odpoveď bez obsahu', () => {
  it('204 No Content vráti undefined namiesto chyby', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    await expect(apiFetch<void>('/recipes/x', { method: 'DELETE' }, { fetchFn })).resolves.toBeUndefined()
  })
})
