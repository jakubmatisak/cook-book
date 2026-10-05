import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { getDb } from '../db/client'
import type { AppEnv } from '../env'
import { HttpError } from '../errors'
import { ensureUser } from '../services/household'

export interface AuthDeps {
  /** Kľúč na overenie Access JWT; v testoch lokálny JWKS, inak sa načíta z Cloudflare. */
  accessKey?: JWTVerifyGetKey
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const jwksCache = new Map<string, JWTVerifyGetKey>()

/** `https://tim.cloudflareaccess.com/` aj `tim.cloudflareaccess.com` → `tim.cloudflareaccess.com` */
const normalizeTeamDomain = (value: string) =>
  value
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')

function remoteJwks(teamDomain: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(teamDomain)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`))
    jwksCache.set(teamDomain, jwks)
  }
  return jwks
}

export function isAllowedEmail(email: string, allowed: string | undefined): boolean {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  return (allowed ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized)
}

/**
 * Zistí e-mail prihláseného používateľa.
 * - S Access tokenom (hlavička alebo cookie) ho overí; neplatný token je vždy 401.
 * - Bez tokenu povolí DEV_USER_EMAIL len na localhoste.
 */
export async function resolveEmail(c: Context<AppEnv>, accessKey?: JWTVerifyGetKey): Promise<string> {
  const token = c.req.header('cf-access-jwt-assertion') ?? getCookie(c, 'CF_Authorization')

  if (token) {
    const team = normalizeTeamDomain(c.env.ACCESS_TEAM_DOMAIN ?? '')
    const aud = c.env.ACCESS_AUD?.trim()
    if (!team || !aud) {
      throw new HttpError(
        500,
        'auth_misconfigured',
        'Prihlásenie nie je nastavené (ACCESS_TEAM_DOMAIN, ACCESS_AUD).',
      )
    }
    try {
      const { payload } = await jwtVerify(token, accessKey ?? remoteJwks(team), {
        issuer: `https://${team}`,
        audience: aud,
      })
      if (typeof payload.email === 'string' && payload.email.trim()) return payload.email
    } catch {
      // neplatný, expirovaný alebo cudzí token → 401 nižšie
    }
    throw new HttpError(401, 'unauthorized', 'Prihlásenie vypršalo alebo je neplatné.')
  }

  const devEmail = c.env.DEV_USER_EMAIL?.trim()
  if (devEmail && LOCAL_HOSTS.has(new URL(c.req.url).hostname)) return devEmail

  throw new HttpError(401, 'unauthorized', 'Nie si prihlásený.')
}

export const authMiddleware = (deps: AuthDeps = {}) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const email = (await resolveEmail(c, deps.accessKey)).trim().toLowerCase()
    if (!isAllowedEmail(email, c.env.ALLOWED_EMAILS)) {
      throw new HttpError(403, 'forbidden', 'Tento účet nemá prístup ku kuchárskej knihe.')
    }
    const db = getDb(c.env)
    c.set('db', db)
    c.set('user', await ensureUser(db, email))
    await next()
  })
