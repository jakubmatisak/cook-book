import { describe, expect, it, vi } from 'vitest'
import { apiFetch, ApiError, filenameFromDisposition } from '@/api/http'

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
      .mockResolvedValue(new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    await expect(apiFetch('/me', undefined, { fetchFn })).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('chybová odpoveď bez JSON tela má generický kód podľa stavu', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 }))
    await expect(apiFetch('/me', undefined, { fetchFn })).rejects.toMatchObject({ status: 502, code: 'http_502' })
  })

  it('výpadok siete je ApiError network_error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiFetch('/me', undefined, { fetchFn })).rejects.toMatchObject({ status: 0, code: 'network_error' })
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
