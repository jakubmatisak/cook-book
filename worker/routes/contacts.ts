import { Hono } from 'hono'
import { contactNameSchema } from '../../shared/schemas/sharing'
import type { AppEnv } from '../env'
import { parseBody } from '../http'
import { deleteContact, listContacts, renameContact } from '../services/sharing'

/** Kontakty domácnosti (e-maily, s ktorými zdieľala recepty). */
export const contactRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await listContacts(c.get('db'), c.get('user').householdId)))
  .patch('/:id', async (c) => {
    const { name } = await parseBody(c, contactNameSchema)
    await renameContact(c.get('db'), c.get('user').householdId, c.req.param('id'), name)
    return c.json({ ok: true })
  })
  .delete('/:id', async (c) => {
    await deleteContact(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.body(null, 204)
  })
