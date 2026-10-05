import { Hono } from 'hono'
import { recipeInputSchema, recipeListQuerySchema } from '../../shared/schemas/recipe'
import type { AppEnv } from '../env'
import { parseBody } from '../http'
import { deleteRecipe, getRecipeDetail, listRecipes, saveRecipe, setFavorite } from '../services/recipes'

export const recipeRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const filters = recipeListQuerySchema.parse(c.req.query())
    const user = c.get('user')
    return c.json(await listRecipes(c.get('db'), user.householdId, user.id, filters))
  })
  .post('/', async (c) => {
    const input = await parseBody(c, recipeInputSchema)
    const user = c.get('user')
    const id = await saveRecipe(c.get('db'), user, input)
    return c.json(await getRecipeDetail(c.get('db'), user.householdId, user.id, id), 201)
  })
  .get('/:id', async (c) => {
    const user = c.get('user')
    return c.json(await getRecipeDetail(c.get('db'), user.householdId, user.id, c.req.param('id')))
  })
  .put('/:id', async (c) => {
    const input = await parseBody(c, recipeInputSchema)
    const user = c.get('user')
    const id = await saveRecipe(c.get('db'), user, input, c.req.param('id'))
    return c.json(await getRecipeDetail(c.get('db'), user.householdId, user.id, id))
  })
  .delete('/:id', async (c) => {
    await deleteRecipe(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.body(null, 204)
  })
  .put('/:id/favorite', async (c) => {
    await setFavorite(c.get('db'), c.get('user'), c.req.param('id'), true)
    return c.body(null, 204)
  })
  .delete('/:id/favorite', async (c) => {
    await setFavorite(c.get('db'), c.get('user'), c.req.param('id'), false)
    return c.body(null, 204)
  })
