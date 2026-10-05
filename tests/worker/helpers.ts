import { env } from 'cloudflare:workers'
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import type { createApp } from '../../worker/app'

export const PROD = 'https://kucharska-kniha.example.workers.dev'
export const LOCAL = 'http://localhost'

type App = ReturnType<typeof createApp>

/** Zavolá Hono aplikáciu priamo s bindingmi testovacieho prostredia. */
export async function call(app: App, url: string, headers: Record<string, string> = {}): Promise<Response> {
  return send(app, 'GET', url, undefined, { headers })
}

export interface SendOptions {
  headers?: Record<string, string>
  /** Prihlásený (dev) používateľ; predvolene ja@example.com. */
  as?: string
}

/** Požiadavka s JSON telom (alebo FormData) na localhost, ako dev používateľ. */
export async function send(
  app: App,
  method: string,
  url: string,
  body?: unknown,
  opts: SendOptions = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...opts.headers }
  let payload: BodyInit | undefined
  if (body instanceof FormData) payload = body
  else if (body !== undefined) {
    payload = JSON.stringify(body)
    headers['content-type'] = 'application/json'
  }
  const testEnv = opts.as ? { ...env, DEV_USER_EMAIL: opts.as } : env
  const ctx = createExecutionContext()
  const res = await app.request(url, { method, headers, body: payload }, testEnv, ctx)
  await waitOnExecutionContext(ctx)
  return res
}

export const api = (path: string) => `${LOCAL}/api/v1${path}`

export async function count(table: string): Promise<number> {
  const row = await env.DB.prepare(`select count(*) as n from ${table}`).first<{ n: number }>()
  return row?.n ?? -1
}
