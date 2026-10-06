import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { getDb } from '../db/client'
import type { AppEnv } from '../env'
import { HttpError } from '../errors'
import { ensureUser, findUserByEmail } from '../services/household'
import { listMemberships, touchLogin, type Membership } from '../services/memberships'

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

/**
 * Vstup do aplikácie: e-mail zo zoznamu správcov (ALLOWED_EMAILS) alebo e-mail s členstvom v nejakej domácnosti.
 * Aktívna domácnosť sa vyberá parametrom `?h=<id>`; bez neho sa použije jediná domácnosť používateľa.
 * Ak ich má viac a `h` chýba, `user.householdId` ostane prázdne a `requireHousehold` odpovie 400.
 */
export const authMiddleware = (deps: AuthDeps = {}) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const email = (await resolveEmail(c, deps.accessKey)).trim().toLowerCase()
    const admin = isAllowedEmail(email, c.env.ALLOWED_EMAILS)
    const db = getDb(c.env)

    let user = await findUserByEmail(db, email)
    let memberships: Membership[] = user ? await listMemberships(db, user.id) : []
    if (!admin && memberships.length === 0) {
      throw new HttpError(403, 'forbidden', 'Tento účet nemá prístup ku kuchárskej knihe.')
    }
    if (admin && memberships.length === 0) {
      user = await ensureUser(db, email)
      memberships = await listMemberships(db, user.id)
    }
    if (!user) throw new HttpError(403, 'forbidden', 'Tento účet nemá prístup ku kuchárskej knihe.')

    const requested = c.req.query('h')
    const active = requested
      ? memberships.find((m) => m.householdId === requested)
      : memberships.length === 1
        ? memberships[0]
        : undefined
    if (requested && !active) {
      throw new HttpError(403, 'forbidden', 'Do tejto domácnosti nemáš prístup.')
    }
    if (active) await touchLogin(db, user.id, active)

    c.set('db', db)
    c.set('memberships', memberships)
    c.set('user', { ...user, householdId: active?.householdId ?? '', role: active?.role ?? 'member' })
    await next()
  })

/** Dáta domácnosti sa dajú čítať až po výbere domácnosti (okrem zoznamu domácností a fotiek). */
export const requireHousehold = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('user').householdId && c.req.path !== '/api/v1/households') {
    throw new HttpError(400, 'household_required', 'Najprv vyber domácnosť.')
  }
  await next()
})
