import type { Db } from './db/client'
import type { HouseholdRole } from '../shared/family'
import type { users } from './db/schema'
import type { Membership } from './services/memberships'

/**
 * Bindingy Workera. Premenné prostredia sú voliteľné: v produkcii DEV_USER_EMAIL neexistuje
 * a ostatné sa nastavujú cez `wrangler secret put` (worker-configuration.d.ts ich typuje podľa .dev.vars).
 */
export interface Bindings {
  DB: D1Database
  BUCKET: R2Bucket
  /** Statické súbory aplikácie (fotky základných receptov v `public/samples`); v testoch chýba. */
  ASSETS?: Fetcher
  ALLOWED_EMAILS?: string
  DEV_USER_EMAIL?: string
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
}

export type UserRow = typeof users.$inferSelect

/** Prihlásený používateľ; `householdId` a `role` platia pre aktívnu domácnosť (prázdne ID = ešte nezvolená). */
export type AuthUser = UserRow & { role: HouseholdRole }

export interface AppEnv {
  Bindings: Bindings
  Variables: { user: AuthUser; memberships: Membership[]; db: Db; fetchFn: typeof fetch }
}
