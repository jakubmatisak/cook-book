import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { exportHousehold } from '../services/export'

export const exportRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const data = await exportHousehold(c.get('db'), c.get('user').householdId)
  const date = data.exportedAt.slice(0, 10)
  c.header('Content-Disposition', `attachment; filename="kucharska-kniha-${date}.json"`)
  c.header('Cache-Control', 'no-store')
  return c.json(data)
})
