import type { Db } from './db/client'
import type { users } from './db/schema'

/**
 * Bindingy Workera. Premenné prostredia sú voliteľné: v produkcii DEV_USER_EMAIL neexistuje
 * a ostatné sa nastavujú cez `wrangler secret put` (worker-configuration.d.ts ich typuje podľa .dev.vars).
 */
export interface Bindings {
  DB: D1Database
  BUCKET: R2Bucket
  ALLOWED_EMAILS?: string
  DEV_USER_EMAIL?: string
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
}

export type UserRow = typeof users.$inferSelect

export interface AppEnv {
  Bindings: Bindings
  Variables: { user: UserRow; db: Db; fetchFn: typeof fetch }
}
