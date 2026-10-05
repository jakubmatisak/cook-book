import { Hono } from 'hono'
import { stapleCreateSchema, stapleUpdateSchema } from '../../shared/schemas/pantry'
import type { AppEnv } from '../env'
import { parseBody } from '../http'
import { createStaple, deleteStaple, listStaples, updateStaple } from '../services/staples'

export const stapleRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await listStaples(c.get('db'), c.get('user').householdId)))
  .post('/', async (c) => {
    const input = await parseBody(c, stapleCreateSchema)
    return c.json(await createStaple(c.get('db'), c.get('user').householdId, input), 201)
  })
  .put('/:id', async (c) => {
    const patch = await parseBody(c, stapleUpdateSchema)
    return c.json(await updateStaple(c.get('db'), c.get('user').householdId, c.req.param('id'), patch))
  })
  .delete('/:id', async (c) => {
    await deleteStaple(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.body(null, 204)
  })
