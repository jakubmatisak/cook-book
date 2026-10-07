import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../worker/app'
import { isAllowedEmail } from '../../worker/middleware/auth'
import type { ApiErrorBody, MeResponse } from '@shared/api'
import { call, LOCAL, PROD } from './helpers'

let privateKey: CryptoKey
let app: ReturnType<typeof createApp>

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  privateKey = pair.privateKey
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' }
  app = createApp({ accessKey: createLocalJWKSet({ keys: [jwk] }) })
})

const sign = (email: string, opts: { aud?: string; exp?: string; iss?: string } = {}) =>
  new SignJWT({ email })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(opts.iss ?? 'https://test.cloudflareaccess.com')
    .setAudience(opts.aud ?? 'test-aud')
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '1h')
    .sign(privateKey)

describe('isAllowedEmail', () => {
  it('ignoruje veľkosť písmen a medzery', () => {
    expect(isAllowedEmail('MANZELKA@example.com', ' ja@example.com , manzelka@EXAMPLE.com ')).toBe(true)
    expect(isAllowedEmail('cudzi@example.com', 'ja@example.com')).toBe(false)
  })

  it('prázdny zoznam nepovolí nikoho', () => {
    expect(isAllowedEmail('ja@example.com', '')).toBe(false)
    expect(isAllowedEmail('ja@example.com', undefined)).toBe(false)
    expect(isAllowedEmail('', ' , ')).toBe(false)
  })
})

describe('Access JWT', () => {
  it('platný token s povoleným e-mailom prejde a e-mail sa uloží malými písmenami', async () => {
    const res = await call(app, `${PROD}/api/v1/me`, {
      'Cf-Access-Jwt-Assertion': await sign('Ja@Example.com'),
    })
    expect(res.status).toBe(200)
    expect((await res.json<MeResponse>()).user.email).toBe('ja@example.com')
  })

  it('token z cookie CF_Authorization prejde', async () => {
    const res = await call(app, `${PROD}/api/v1/me`, {
      Cookie: `theme=dark; CF_Authorization=${await sign('ja@example.com')}`,
    })
    expect(res.status).toBe(200)
  })

  it('bez tokenu na produkčnom hoste je 401 aj s nastaveným DEV_USER_EMAIL', async () => {
    const res = await call(app, `${PROD}/api/v1/me`)
    expect(res.status).toBe(401)
    expect((await res.json<ApiErrorBody>()).error.code).toBe('unauthorized')
  })

  it('zlé aud, expirovaný token, cudzí issuer a nezmysel sú 401', async () => {
    const tokens = [
      await sign('ja@example.com', { aud: 'iny' }),
      await sign('ja@example.com', { exp: '-1m' }),
      await sign('ja@example.com', { iss: 'https://zly.example.com' }),
      'nie-je-to-jwt',
    ]
    for (const token of tokens) {
      const res = await call(app, `${PROD}/api/v1/me`, { 'Cf-Access-Jwt-Assertion': token })
      expect(res.status).toBe(401)
    }
  })

  it('neplatný token na localhoste neprepadne do dev režimu', async () => {
    const res = await call(app, `${LOCAL}/api/v1/me`, { 'Cf-Access-Jwt-Assertion': 'nie-je-to-jwt' })
    expect(res.status).toBe(401)
  })

  it('e-mail bez domácnosti (pustil ho len Access) dostane 403 no_household, kým si domácnosť nezaloží', async () => {
    const res = await call(app, `${PROD}/api/v1/me`, {
      'Cf-Access-Jwt-Assertion': await sign('cudzi@example.com'),
    })
    expect(res.status).toBe(403)
    expect((await res.json<ApiErrorBody>()).error.code).toBe('no_household')
  })

  it('na localhoste bez tokenu použije DEV_USER_EMAIL', async () => {
    const res = await call(app, `${LOCAL}/api/v1/me`)
    expect(res.status).toBe(200)
    expect((await res.json<MeResponse>()).user.email).toBe('ja@example.com')
  })

  it('health nevyžaduje prihlásenie', async () => {
    const res = await call(app, `${PROD}/api/v1/health`)
    expect(res.status).toBe(200)
  })
})
