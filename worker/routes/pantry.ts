import { Hono } from 'hono'
import { pantryItemSchema } from '../../shared/schemas/pantry'
import type { AppEnv } from '../env'
import { HttpError } from '../errors'
import { addToPantry, getPantry, removeFromPantry, savePantryItem } from '../services/pantry'

export const pantryRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await getPantry(c.get('db'), c.get('user').householdId)))
  // Bez tela len označí „mám doma“ (204); s telom uloží množstvo, trvanlivosť a miesto (200).
  .put('/:ingredientId', async (c) => {
    const { householdId } = c.get('user')
    const ingredientId = c.req.param('ingredientId')
    const raw = (await c.req.text()).trim()
    if (!raw) {
      await addToPantry(c.get('db'), householdId, ingredientId)
      return c.body(null, 204)
    }
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      throw new HttpError(400, 'invalid_json', 'Telo požiadavky nie je platný JSON.')
    }
    return c.json(await savePantryItem(c.get('db'), householdId, ingredientId, pantryItemSchema.parse(body)))
  })
  .delete('/:ingredientId', async (c) => {
    await removeFromPantry(c.get('db'), c.get('user').householdId, c.req.param('ingredientId'))
    return c.body(null, 204)
  })
