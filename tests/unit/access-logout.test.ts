import { describe, expect, it } from 'vitest'
import { ACCESS_LOGOUT_PATH, canLogout } from '@/lib/auth'

describe('odhlásenie z Cloudflare Access', () => {
  it('používa adresu Access na doméne aplikácie', () => {
    expect(ACCESS_LOGOUT_PATH).toBe('/cdn-cgi/access/logout')
  })

  it('lokálne (bez Access) sa odhlásenie neponúka, na ostrej doméne áno', () => {
    expect(canLogout('localhost')).toBe(false)
    expect(canLogout('127.0.0.1')).toBe(false)
    expect(canLogout('[::1]')).toBe(false)
    expect(canLogout('cook-book.example.workers.dev')).toBe(true)
  })
})
