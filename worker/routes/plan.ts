import { Hono } from 'hono'
import type { PlanCopyResult } from '../../shared/api'
import {
  guestStayInputSchema,
  planCopySchema,
  planEntryInputSchema,
  planRangeQuerySchema,
  templateApplySchema,
  templateCreateSchema,
} from '../../shared/schemas/plan'
import type { AppEnv } from '../env'
import { parseBody } from '../http'
import { copyPlan, createEntry, deleteEntry, listPlan, updateEntry } from '../services/plan'
import { createStays, deleteStay, listStays } from '../services/stays'
import { applyTemplate, deleteTemplate, listTemplates, saveTemplate } from '../services/templates'

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
  .get('/templates', async (c) => c.json(await listTemplates(c.get('db'), c.get('user').householdId)))
  .post('/templates', async (c) => {
    const input = await parseBody(c, templateCreateSchema)
    return c.json(await saveTemplate(c.get('db'), c.get('user').householdId, input), 201)
  })
  .post('/templates/:id/apply', async (c) => {
    const input = await parseBody(c, templateApplySchema)
    return c.json(await applyTemplate(c.get('db'), c.get('user').householdId, c.req.param('id'), input))
  })
  .delete('/templates/:id', async (c) => {
    await deleteTemplate(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.body(null, 204)
  })
  // Pobyty návštev: jedlá v dňoch pobytu s návštevou počítajú automaticky.
  .get('/stays', async (c) => {
    const { from, to } = planRangeQuerySchema.parse(c.req.query())
    return c.json(await listStays(c.get('db'), c.get('user').householdId, from, to))
  })
  .post('/stays', async (c) => {
    const input = await parseBody(c, guestStayInputSchema)
    return c.json(await createStays(c.get('db'), c.get('user').householdId, input), 201)
  })
  .delete('/stays/:id', async (c) => {
    await deleteStay(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.body(null, 204)
  })
  .post('/copy', async (c) => {
    const input = await parseBody(c, planCopySchema)
    const body: PlanCopyResult = { copied: await copyPlan(c.get('db'), c.get('user').householdId, input) }
    return c.json(body)
  })
