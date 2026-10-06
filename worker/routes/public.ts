import { Hono } from 'hono'
import { publicRecipeListQuerySchema } from '../../shared/schemas/recipe'
import type { AppEnv } from '../env'
import { copyPublicRecipe, getPublicRecipe, listPublicRecipes } from '../services/publicRecipes'

/** Verejné recepty: čítať a kopírovať ich smie každý prihlásený, bez ohľadu na domácnosť. */
export const publicRoutes = new Hono<AppEnv>()
  .get('/recipes', async (c) => {
    const query = publicRecipeListQuerySchema.parse(c.req.query())
    return c.json(await listPublicRecipes(c.get('db'), c.get('user'), query))
  })
  .get('/recipes/:id', async (c) =>
    c.json(await getPublicRecipe(c.get('db'), c.get('user'), c.req.param('id'))),
  )
  .post('/recipes/:id/copy', async (c) =>
    c.json(await copyPublicRecipe(c.get('db'), c.env.BUCKET, c.get('user'), c.req.param('id')), 201),
  )
