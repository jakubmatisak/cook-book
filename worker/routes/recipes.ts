import { Hono } from 'hono'
import { markdownFilename, recipeToMarkdown } from '../../shared/markdown'
import {
  markdownQuerySchema,
  recipeImportSchema,
  recipeInputSchema,
  recipeListQuerySchema,
  recipeVisibilitySchema,
  suggestionsQuerySchema,
} from '../../shared/schemas/recipe'
import type { AppEnv } from '../env'
import { parseBody } from '../http'
import { todayInZone } from '../../shared/dates'
import { backfillCookLog } from '../services/cookLog'
import { importRecipe } from '../services/importRecipe'
import { suggestRecipes } from '../services/suggestions'
import { requireOwner } from '../middleware/owner'
import {
  deleteRecipe,
  getRecipeDetail,
  listRecipes,
  saveRecipe,
  setFavorite,
  setRecipeVisibility,
} from '../services/recipes'

const HOUSEHOLD_TIME_ZONE = 'Europe/Bratislava'

export const recipeRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const filters = recipeListQuerySchema.parse(c.req.query())
    const user = c.get('user')
    await backfillCookLog(c.get('db'), user.householdId, todayInZone(new Date(), HOUSEHOLD_TIME_ZONE))
    const { missing, kids, ...rest } = filters
    const options = {
      ...rest,
      ...(missing === undefined ? {} : { missingMax: missing }),
      ...(kids ? { includeKids: true } : {}),
    }
    return c.json(await listRecipes(c.get('db'), user.householdId, user.id, options))
  })
  // Pred `/:id`, aby „suggestions“ nepadlo ako id receptu.
  .get('/suggestions', async (c) => {
    const { date } = suggestionsQuerySchema.parse(c.req.query())
    const user = c.get('user')
    await backfillCookLog(c.get('db'), user.householdId, todayInZone(new Date(), HOUSEHOLD_TIME_ZONE))
    return c.json(await suggestRecipes(c.get('db'), user.householdId, user.id, date))
  })
  .post('/import', async (c) => {
    const { url } = await parseBody(c, recipeImportSchema)
    const result = await importRecipe(
      { fetchFn: c.get('fetchFn'), db: c.get('db'), bucket: c.env.BUCKET, user: c.get('user') },
      url,
    )
    return c.json(result)
  })
  .post('/', async (c) => {
    const input = await parseBody(c, recipeInputSchema)
    const user = c.get('user')
    const id = await saveRecipe(c.get('db'), user, input)
    return c.json(await getRecipeDetail(c.get('db'), user.householdId, user.id, id), 201)
  })
  // Zverejnenie a skrytie receptu smie len vlastník domácnosti.
  .put('/:id/visibility', requireOwner, async (c) => {
    const { visibility } = await parseBody(c, recipeVisibilitySchema)
    const user = c.get('user')
    await setRecipeVisibility(c.get('db'), user.householdId, c.req.param('id'), visibility)
    return c.json(await getRecipeDetail(c.get('db'), user.householdId, user.id, c.req.param('id')))
  })
  .get('/:id/export.md', async (c) => {
    const { porcie } = markdownQuerySchema.parse(c.req.query())
    const user = c.get('user')
    const recipe = await getRecipeDetail(c.get('db'), user.householdId, user.id, c.req.param('id'))
    return c.body(recipeToMarkdown(recipe, { servings: porcie }), 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${markdownFilename(recipe.title)}"`,
      'Cache-Control': 'no-store',
    })
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
