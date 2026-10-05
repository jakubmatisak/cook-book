import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { addToPantry, getPantry, removeFromPantry } from '../services/pantry'

export const pantryRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await getPantry(c.get('db'), c.get('user').householdId)))
  .put('/:ingredientId', async (c) => {
    await addToPantry(c.get('db'), c.get('user').householdId, c.req.param('ingredientId'))
    return c.body(null, 204)
  })
  .delete('/:ingredientId', async (c) => {
    await removeFromPantry(c.get('db'), c.get('user').householdId, c.req.param('ingredientId'))
    return c.body(null, 204)
  })
