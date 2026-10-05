import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { ShopCategoryDto } from '../../shared/api'
import { ingredientCreateSchema, ingredientUpdateSchema, tagInputSchema } from '../../shared/schemas/recipe'
import { shopCategories } from '../db/schema'
import type { AppEnv } from '../env'
import { parseBody } from '../http'
import { createIngredient, listIngredients, updateIngredient } from '../services/catalog'
import { createTag, deleteTag, listTags, updateTag } from '../services/tags'

export const ingredientRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const { q } = z.object({ q: z.string().max(100).optional() }).parse(c.req.query())
    return c.json(await listIngredients(c.get('db'), c.get('user').householdId, q))
  })
  .post('/', async (c) => {
    const input = await parseBody(c, ingredientCreateSchema)
    return c.json(await createIngredient(c.get('db'), c.get('user').householdId, input), 201)
  })
  .put('/:id', async (c) => {
    const input = await parseBody(c, ingredientUpdateSchema)
    return c.json(await updateIngredient(c.get('db'), c.get('user').householdId, c.req.param('id'), input))
  })

export const tagRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await listTags(c.get('db'), c.get('user').householdId)))
  .post('/', async (c) => {
    const input = await parseBody(c, tagInputSchema)
    return c.json(await createTag(c.get('db'), c.get('user').householdId, input), 201)
  })
  .put('/:id', async (c) => {
    const input = await parseBody(c, tagInputSchema)
    return c.json(await updateTag(c.get('db'), c.get('user').householdId, c.req.param('id'), input))
  })
  .delete('/:id', async (c) => {
    await deleteTag(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.body(null, 204)
  })

export const shopCategoryRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const rows: ShopCategoryDto[] = await c
    .get('db')
    .select({ id: shopCategories.id, name: shopCategories.name, sortOrder: shopCategories.sortOrder })
    .from(shopCategories)
    .where(eq(shopCategories.householdId, c.get('user').householdId))
    .orderBy(asc(shopCategories.sortOrder), asc(shopCategories.name))
  return c.json(rows)
})
