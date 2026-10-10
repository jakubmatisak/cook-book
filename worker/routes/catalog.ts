import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { ShopCategoryDto } from '../../shared/api'
import { ingredientCreateSchema, ingredientUpdateSchema, tagInputSchema } from '../../shared/schemas/recipe'
import { bulkIdsSchema, ingredientBulkUpdateSchema, ingredientMergeSchema } from '../../shared/schemas/bulk'
import { shopCategories } from '../db/schema'
import { bulkDeleteIngredients, bulkUpdateIngredients } from '../services/bulk'
import { mergeIngredients } from '../services/merge'
import { addMergeIgnored, getMergeIgnored, ingredientUnits } from '../services/ingredientMergeHelp'
import type { AppEnv } from '../env'
import { parseBody } from '../http'
import {
  addStarterIngredients,
  createIngredient,
  deleteIngredient,
  listIngredients,
  starterStatus,
  updateIngredient,
} from '../services/catalog'
import { createTag, deleteTag, listTags, updateTag } from '../services/tags'

const mergeIgnoreSchema = z.object({ ids: z.array(z.string().min(1).max(40)).min(2).max(50) })
const unitsQuerySchema = z
  .string()
  .transform((v) => [
    ...new Set(
      v
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ])
  .pipe(z.array(z.string().max(40)).min(1).max(50))

export const ingredientRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const { q } = z.object({ q: z.string().max(100).optional() }).parse(c.req.query())
    return c.json(await listIngredients(c.get('db'), c.get('user').householdId, q))
  })
  .post('/', async (c) => {
    const input = await parseBody(c, ingredientCreateSchema)
    return c.json(await createIngredient(c.get('db'), c.get('user').householdId, input), 201)
  })
  .post('/bulk/update', async (c) => {
    const input = await parseBody(c, ingredientBulkUpdateSchema)
    const { ids, ...patch } = input
    return c.json(await bulkUpdateIngredients(c.get('db'), c.get('user').householdId, { ids, ...patch }))
  })
  // Návrhy na zlúčenie: ignorované skupiny domácnosti a jednotky pred zlúčením (upozornenie na g vs. ks).
  .get('/merge-ignored', async (c) => c.json(await getMergeIgnored(c.get('db'), c.get('user').householdId)))
  .post('/merge-ignored', async (c) => {
    const { ids } = await parseBody(c, mergeIgnoreSchema)
    await addMergeIgnored(c.get('db'), c.get('user').householdId, ids)
    return c.json({ ok: true })
  })
  .get('/units', async (c) => {
    const ids = unitsQuerySchema.parse(c.req.query('ids') ?? '')
    return c.json(await ingredientUnits(c.get('db'), c.get('user').householdId, ids))
  })
  .post('/merge', async (c) => {
    const input = await parseBody(c, ingredientMergeSchema)
    return c.json(await mergeIngredients(c.get('db'), c.get('user').householdId, input))
  })
  .post('/bulk/delete', async (c) => {
    const { ids } = await parseBody(c, bulkIdsSchema)
    return c.json(await bulkDeleteIngredients(c.get('db'), c.get('user').householdId, ids))
  })
  .get('/starter', async (c) => c.json(await starterStatus(c.get('db'), c.get('user').householdId)))
  .post('/starter', async (c) => c.json(await addStarterIngredients(c.get('db'), c.get('user').householdId)))
  .put('/:id', async (c) => {
    const input = await parseBody(c, ingredientUpdateSchema)
    return c.json(await updateIngredient(c.get('db'), c.get('user').householdId, c.req.param('id'), input))
  })
  .delete('/:id', async (c) => {
    await deleteIngredient(c.get('db'), c.get('user').householdId, c.req.param('id'))
    return c.body(null, 204)
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
