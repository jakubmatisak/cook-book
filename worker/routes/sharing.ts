import { Hono } from 'hono'
import { createShareSchema } from '../../shared/schemas/sharing'
import type { AppEnv } from '../env'
import { parseBody } from '../http'
import { createShares } from '../services/sharing'

/** Zdieľanie receptov s inými domácnosťami cez e-mail (verejný odkaz `/s/<kód>` je v `/shared`). */
export const sharingRoutes = new Hono<AppEnv>().post('/', async (c) => {
  const input = await parseBody(c, createShareSchema)
  return c.json(await createShares(c.get('db'), c.get('user'), input), 201)
})
