import { env } from 'cloudflare:workers'
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import worker from '../../worker/index'
import { PROD } from './helpers'

describe('/auth/relogin', () => {
  it('po prihlásení cez Access presmeruje späť na úvod aplikácie', async () => {
    const ctx = createExecutionContext()
    const res = await worker.fetch(new Request(`${PROD}/auth/relogin`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(`${PROD}/`)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
