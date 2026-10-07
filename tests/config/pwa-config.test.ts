import { describe, expect, it } from 'vitest'
import { pwaOptions } from '../../pwa.config'

const workbox = pwaOptions.workbox!

describe('PWA manifest za Cloudflare Access', () => {
  it('manifest sa sťahuje s prihlasovacími cookies, inak ho Access presmeruje na prihlásenie a PWA sa nedá nainštalovať', () => {
    expect(pwaOptions.useCredentials).toBe(true)
  })
})

describe('PWA service worker', () => {
  it('API cache ukladá len JSON odpovede so stavom 200', () => {
    const api = workbox.runtimeCaching!.find((r) => r.options?.cacheName === 'api')
    expect(api?.options?.cacheableResponse).toEqual({
      statuses: [200],
      headers: { 'content-type': 'application/json' },
    })
  })

  it('nepodsunie index.html pre API, obrázky, Access ani opätovné prihlásenie', () => {
    const deny = workbox.navigateFallbackDenylist!
    for (const path of ['/api/v1/me', '/img/a.webp', '/cdn-cgi/access/login', '/auth/relogin']) {
      expect(deny.some((r) => r.test(path))).toBe(true)
    }
    expect(deny.some((r) => r.test('/recepty/123'))).toBe(false)
  })
})
