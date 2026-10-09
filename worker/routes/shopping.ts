import { Hono } from 'hono'
import {
  generateSchema,
  itemBatchSchema,
  itemCheckSchema,
  itemCreateSchema,
  itemPatchSchema,
} from '../../shared/schemas/shopping'
import type { AppEnv } from '../env'
import { parseBody } from '../http'
import {
  applyBatch,
  checkItems,
  clearAll,
  clearChecked,
  moveCheckedToPantry,
  createItem,
  deleteItem,
  generateItems,
  listItems,
  listLists,
  patchItem,
} from '../services/shopping'

export const shoppingRoutes = new Hono<AppEnv>()
  .get('/lists', async (c) => c.json(await listLists(c.get('db'), c.get('user').householdId)))
  .get('/lists/:id/items', async (c) => {
    c.header('Cache-Control', 'no-store')
    return c.json(await listItems(c.get('db'), c.get('user').householdId, c.req.param('id')))
  })
  .post('/lists/:id/generate', async (c) => {
    const input = await parseBody(c, generateSchema)
    return c.json(await generateItems(c.get('db'), c.get('user').householdId, c.req.param('id'), input))
  })
  .post('/lists/:id/items', async (c) => {
    const input = await parseBody(c, itemCreateSchema)
    return c.json(await createItem(c.get('db'), c.get('user').householdId, c.req.param('id'), input), 201)
  })
  .post('/lists/:id/clear-checked', async (c) => {
    const removed = await clearChecked(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.json({ removed })
  })
  .post('/lists/:id/check', async (c) => {
    const input = await parseBody(c, itemCheckSchema)
    return c.json({ changed: await checkItems(c.get('db'), c.get('user'), c.req.param('id'), input) })
  })
  .post('/lists/:id/clear-all', async (c) => {
    const removed = await clearAll(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.json({ removed })
  })
  .post('/lists/:id/move-to-pantry', async (c) =>
    c.json(await moveCheckedToPantry(c.get('db'), c.get('user').householdId, c.req.param('id'))),
  )
  .post('/items/batch', async (c) => {
    const input = await parseBody(c, itemBatchSchema)
    return c.json({ applied: await applyBatch(c.get('db'), c.get('user'), input) })
  })
  .patch('/items/:id', async (c) => {
    const patch = await parseBody(c, itemPatchSchema)
    return c.json(await patchItem(c.get('db'), c.get('user'), c.req.param('id'), patch))
  })
  .delete('/items/:id', async (c) => {
    await deleteItem(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.body(null, 204)
  })
