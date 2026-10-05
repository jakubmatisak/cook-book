import { env } from 'cloudflare:workers'
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import type { createApp } from '../../worker/app'

export const PROD = 'https://kucharska-kniha.example.workers.dev'
export const LOCAL = 'http://localhost'

/** Zavolá Hono aplikáciu priamo s bindingmi testovacieho prostredia. */
export async function call(
  app: ReturnType<typeof createApp>,
  url: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  const ctx = createExecutionContext()
  const res = await app.request(url, { headers }, env, ctx)
  await waitOnExecutionContext(ctx)
  return res
}

export async function count(table: string): Promise<number> {
  const row = await env.DB.prepare(`select count(*) as n from ${table}`).first<{ n: number }>()
  return row?.n ?? -1
}
