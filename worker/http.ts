import type { Context } from 'hono'
import type { z } from 'zod'
import { HttpError } from './errors'

/** Prečíta JSON telo a zvaliduje ho schémou; poškodený JSON je 400, chyby schémy 400 cez ZodError. */
export async function parseBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new HttpError(400, 'invalid_json', 'Telo požiadavky nie je platný JSON.')
  }
  return schema.parse(body)
}

/** Rozdelí pole na kúsky (D1 povoľuje max 100 viazaných parametrov na príkaz). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
