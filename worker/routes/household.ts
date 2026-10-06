import { Hono } from 'hono'
import { householdNameSchema, inviteMemberSchema, memberRoleSchema } from '../../shared/schemas/household'
import type { AppEnv } from '../env'
import { parseBody } from '../http'
import { requireOwner } from '../middleware/owner'
import {
  changeMemberRole,
  inviteHouseholdMember,
  listHouseholdMembers,
  removeMember,
  renameHousehold,
} from '../services/memberships'

/** Aktívna domácnosť: členovia a názov. Čítať môže každý člen, meniť len vlastník. */
export const householdRoutes = new Hono<AppEnv>()
  .put('/', requireOwner, async (c) => {
    const { name } = await parseBody(c, householdNameSchema)
    await renameHousehold(c.get('db'), c.get('user').householdId, name)
    return c.json({ id: c.get('user').householdId, name })
  })
  .get('/members', async (c) =>
    c.json(await listHouseholdMembers(c.get('db'), c.get('user').householdId, c.env.ALLOWED_EMAILS)),
  )
  .post('/members', requireOwner, async (c) => {
    const input = await parseBody(c, inviteMemberSchema)
    const member = await inviteHouseholdMember(
      c.get('db'),
      c.get('user').householdId,
      input.email,
      input.role,
      c.env.ALLOWED_EMAILS,
    )
    return c.json(member, 201)
  })
  .put('/members/:userId', requireOwner, async (c) => {
    const { role } = await parseBody(c, memberRoleSchema)
    return c.json(
      await changeMemberRole(
        c.get('db'),
        c.get('user').householdId,
        c.req.param('userId'),
        role,
        c.env.ALLOWED_EMAILS,
      ),
    )
  })
  .delete('/members/:userId', requireOwner, async (c) => {
    await removeMember(c.get('db'), c.get('user').householdId, c.req.param('userId'), c.env.ALLOWED_EMAILS)
    return c.body(null, 204)
  })
