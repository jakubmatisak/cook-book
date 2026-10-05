import { Hono } from 'hono'
import type { PlanCopyResult } from '../../shared/api'
import { planCopySchema, planEntryInputSchema, planRangeQuerySchema } from '../../shared/schemas/plan'
import type { AppEnv } from '../env'
import { parseBody } from '../http'
import { copyPlan, createEntry, deleteEntry, listPlan, updateEntry } from '../services/plan'

export const planRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const { from, to } = planRangeQuerySchema.parse(c.req.query())
    return c.json(await listPlan(c.get('db'), c.get('user').householdId, from, to))
  })
  .post('/entries', async (c) => {
    const input = await parseBody(c, planEntryInputSchema)
    return c.json(await createEntry(c.get('db'), c.get('user').householdId, input), 201)
  })
  .put('/entries/:id', async (c) => {
    const input = await parseBody(c, planEntryInputSchema)
    return c.json(await updateEntry(c.get('db'), c.get('user').householdId, c.req.param('id'), input))
  })
  .delete('/entries/:id', async (c) => {
    await deleteEntry(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.body(null, 204)
  })
  .post('/copy', async (c) => {
    const input = await parseBody(c, planCopySchema)
    const body: PlanCopyResult = { copied: await copyPlan(c.get('db'), c.get('user').householdId, input) }
    return c.json(body)
  })
