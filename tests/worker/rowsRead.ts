import { env } from 'cloudflare:workers'
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import type { createApp } from '../../worker/app'
import { api } from './helpers'

interface Captured {
  sql: string
  params: unknown[]
}

/**
 * Koľko riadkov D1 prečíta jedna požiadavka (limit free plánu je 5 mil. denne). Zachytí všetky SELECTy požiadavky,
 * po nej ich spustí znova a sčíta `meta.rows_read`.
 */
export async function rowsRead(
  app: ReturnType<typeof createApp>,
  path: string,
  as: string,
): Promise<{ rows: number; status: number; queries: { sql: string; rows: number }[] }> {
  const captured: Captured[] = []
  const db = env.DB
  const counting = new Proxy(db, {
    get(target, prop) {
      if (prop === 'prepare') {
        return (sql: string) => {
          const stmt = target.prepare(sql)
          captured.push({ sql, params: [] })
          const entry = captured[captured.length - 1]!
          return new Proxy(stmt, {
            get(s, p) {
              if (p === 'bind') {
                return (...args: unknown[]) => {
                  entry.params = args
                  return s.bind(...args)
                }
              }
              const value = Reflect.get(s, p, s) as unknown
              return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(s) : value
            },
          })
        }
      }
      const value = Reflect.get(target, prop, target) as unknown
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
    },
  })
  const ctx = createExecutionContext()
  const res = await app.request(api(path), {}, { ...env, DB: counting, DEV_USER_EMAIL: as }, ctx)
  await waitOnExecutionContext(ctx)

  const queries: { sql: string; rows: number }[] = []
  for (const q of captured) {
    if (!/^\s*select/i.test(q.sql)) continue
    const result = await db
      .prepare(q.sql)
      .bind(...q.params)
      .all()
    queries.push({ sql: q.sql, rows: result.meta.rows_read ?? 0 })
  }
  return { rows: queries.reduce((sum, q) => sum + q.rows, 0), status: res.status, queries }
}
