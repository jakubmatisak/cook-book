import { Hono } from 'hono'
import { getDb } from '../db/client'
import type { AppEnv } from '../env'
import { getSharedCover, getSharedRecipe } from '../services/share'

/**
 * Recept otvorený odkazom na zdieľanie – bez prihlásenia (v Cloudflare Access má táto cesta výnimku „Bypass“).
 * Kód v adrese je jediné oprávnenie; po zastavení zdieľania je 404.
 */
export const sharedRoutes = new Hono<AppEnv>()
  .get('/:token', async (c) => {
    c.header('Cache-Control', 'no-store')
    return c.json(await getSharedRecipe(getDb(c.env), c.req.param('token')))
  })
  .get('/:token/cover', async (c) => {
    const { body, mime } = await getSharedCover(getDb(c.env), c.env.BUCKET, c.req.param('token'))
    return new Response(body, { headers: { 'Content-Type': mime, 'Cache-Control': 'private, max-age=3600' } })
  })
