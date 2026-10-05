import { Hono } from 'hono'
import {
  memberInputSchema,
  memberPreferencesSchema,
  settingsUpdateSchema,
  slotUpdateSchema,
} from '../../shared/schemas/family'
import type { AppEnv } from '../env'
import { parseBody } from '../http'
import {
  createMember,
  deleteMember,
  listMembers,
  saveMemberPreferences,
  updateMember,
  updateSettings,
  updateSlot,
} from '../services/family'

export const memberRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await listMembers(c.get('db'), c.get('user').householdId)))
  .post('/', async (c) => {
    const input = await parseBody(c, memberInputSchema)
    return c.json(await createMember(c.get('db'), c.get('user').householdId, input), 201)
  })
  .put('/:id', async (c) => {
    const input = await parseBody(c, memberInputSchema)
    return c.json(await updateMember(c.get('db'), c.get('user').householdId, c.req.param('id'), input))
  })
  .put('/:id/preferences', async (c) => {
    const input = await parseBody(c, memberPreferencesSchema)
    return c.json(
      await saveMemberPreferences(c.get('db'), c.get('user').householdId, c.req.param('id'), input),
    )
  })
  .delete('/:id', async (c) => {
    await deleteMember(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.body(null, 204)
  })

export const slotRoutes = new Hono<AppEnv>().put('/:id', async (c) => {
  const patch = await parseBody(c, slotUpdateSchema)
  return c.json(await updateSlot(c.get('db'), c.get('user').householdId, c.req.param('id'), patch))
})

export const settingsRoutes = new Hono<AppEnv>().put('/', async (c) => {
  const patch = await parseBody(c, settingsUpdateSchema)
  return c.json(await updateSettings(c.get('db'), c.get('user').householdId, patch))
})
