import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { IngredientDto } from '../../shared/api'
import { normalizeText } from '../../shared/text'
import type { UnitCode } from '../../shared/units'
import type { Db } from '../db/client'
import { ingredients, shopCategories, tags } from '../db/schema'
import { HttpError } from '../errors'
import { chunk } from '../http'

type IngredientRow = typeof ingredients.$inferSelect

// Explicitné názvy tabuliek: Drizzle v jednotabuľkovom dotaze stĺpce nekvalifikuje.
const usageCount = sql<number>`(
  select count(*) from recipe_ingredients ri
  join recipes r on r.id = ri.recipe_id
  where ri.ingredient_id = "ingredients"."id" and r.deleted_at is null
)`.mapWith(Number)

export function toIngredientDto(row: IngredientRow, usage: number): IngredientDto {
  return {
    id: row.id,
    name: row.name,
    defaultUnit: row.defaultUnit,
    shopCategoryId: row.shopCategoryId,
    usageCount: usage,
  }
}

export async function listIngredients(db: Db, householdId: string, q?: string): Promise<IngredientDto[]> {
  const needle = q ? normalizeText(q).replace(/[%_]/g, '') : ''
  const rows = await db
    .select({ row: ingredients, usage: usageCount })
    .from(ingredients)
    .where(
      and(
        eq(ingredients.householdId, householdId),
        isNull(ingredients.deletedAt),
        needle ? sql`${ingredients.nameNormalized} like ${`%${needle}%`}` : undefined,
      ),
    )
    .orderBy(asc(ingredients.nameNormalized))
  return rows.map((r) => toIngredientDto(r.row, r.usage))
}

export async function getIngredientDto(db: Db, householdId: string, id: string): Promise<IngredientDto> {
  const found = await db
    .select({ row: ingredients, usage: usageCount })
    .from(ingredients)
    .where(
      and(eq(ingredients.id, id), eq(ingredients.householdId, householdId), isNull(ingredients.deletedAt)),
    )
    .get()
  if (!found) throw new HttpError(404, 'not_found', 'Ingrediencia neexistuje.')
  return toIngredientDto(found.row, found.usage)
}

export async function assertShopCategory(db: Db, householdId: string, id: string | null | undefined) {
  if (!id) return
  const found = await db
    .select({ id: shopCategories.id })
    .from(shopCategories)
    .where(and(eq(shopCategories.id, id), eq(shopCategories.householdId, householdId)))
    .get()
  if (!found) throw new HttpError(400, 'invalid_shop_category', 'Kategória obchodu neexistuje.')
}

async function findByNormalized(db: Db, householdId: string, normalized: string) {
  return db
    .select()
    .from(ingredients)
    .where(and(eq(ingredients.householdId, householdId), eq(ingredients.nameNormalized, normalized)))
    .get()
}

export async function createIngredient(
  db: Db,
  householdId: string,
  input: { name: string; defaultUnit?: UnitCode | null; shopCategoryId?: string | null },
): Promise<IngredientDto> {
  await assertShopCategory(db, householdId, input.shopCategoryId)
  const nameNormalized = normalizeText(input.name)
  const existing = await findByNormalized(db, householdId, nameNormalized)
  if (existing && !existing.deletedAt) {
    throw new HttpError(409, 'duplicate', `Ingrediencia „${existing.name}“ už existuje.`)
  }
  if (existing) {
    await db
      .update(ingredients)
      .set({
        name: input.name,
        deletedAt: null,
        defaultUnit: input.defaultUnit ?? null,
        shopCategoryId: input.shopCategoryId ?? null,
      })
      .where(eq(ingredients.id, existing.id))
    return getIngredientDto(db, householdId, existing.id)
  }
  const [row] = await db
    .insert(ingredients)
    .values({
      householdId,
      name: input.name,
      nameNormalized,
      defaultUnit: input.defaultUnit ?? null,
      shopCategoryId: input.shopCategoryId ?? null,
    })
    .returning()
  return toIngredientDto(row!, 0)
}

export async function updateIngredient(
  db: Db,
  householdId: string,
  id: string,
  input: { name?: string; defaultUnit?: UnitCode | null; shopCategoryId?: string | null },
): Promise<IngredientDto> {
  await getIngredientDto(db, householdId, id)
  await assertShopCategory(db, householdId, input.shopCategoryId)
  const patch: Partial<IngredientRow> = {}
  if (input.name !== undefined) {
    const nameNormalized = normalizeText(input.name)
    const clash = await findByNormalized(db, householdId, nameNormalized)
    if (clash && clash.id !== id) {
      throw new HttpError(409, 'duplicate', `Ingrediencia „${clash.name}“ už existuje.`)
    }
    patch.name = input.name
    patch.nameNormalized = nameNormalized
  }
  if (input.defaultUnit !== undefined) patch.defaultUnit = input.defaultUnit
  if (input.shopCategoryId !== undefined) patch.shopCategoryId = input.shopCategoryId
  if (Object.keys(patch).length > 0) await db.update(ingredients).set(patch).where(eq(ingredients.id, id))
  return getIngredientDto(db, householdId, id)
}

/**
 * Nájde alebo založí ingrediencie podľa mena (bez ohľadu na diakritiku a veľkosť písmen).
 * Zmazané obnoví. Nové dostanú ako predvolenú jednotku prvú použitú.
 * Vracia mapu normalizovaný názov → id.
 */
export async function resolveIngredients(
  db: Db,
  householdId: string,
  items: readonly { name: string; unit: UnitCode | null }[],
): Promise<Map<string, string>> {
  const wanted = new Map<string, { name: string; unit: UnitCode | null }>()
  for (const item of items) {
    const key = normalizeText(item.name)
    if (!wanted.has(key)) wanted.set(key, { name: item.name, unit: item.unit })
  }
  const keys = [...wanted.keys()]
  const result = new Map<string, string>()
  if (keys.length === 0) return result

  const loadExisting = async () => {
    for (const part of chunk(keys, 90)) {
      const rows = await db
        .select({ id: ingredients.id, key: ingredients.nameNormalized, deletedAt: ingredients.deletedAt })
        .from(ingredients)
        .where(and(eq(ingredients.householdId, householdId), inArray(ingredients.nameNormalized, part)))
      for (const r of rows) result.set(r.key, r.id)
      const deleted = rows.filter((r) => r.deletedAt).map((r) => r.id)
      if (deleted.length) {
        await db.update(ingredients).set({ deletedAt: null }).where(inArray(ingredients.id, deleted))
      }
    }
  }

  await loadExisting()
  const missing = keys.filter((k) => !result.has(k))
  if (missing.length) {
    const [first, ...rest] = missing.map((key) => {
      const item = wanted.get(key)!
      return db
        .insert(ingredients)
        .values({ householdId, name: item.name, nameNormalized: key, defaultUnit: item.unit })
        .onConflictDoNothing()
    })
    await db.batch([first!, ...rest])
    await loadExisting()
  }
  return result
}

/** Nájde alebo založí tagy podľa mena (porovnanie bez diakritiky); vracia id v poradí vstupu. */
export async function resolveTags(db: Db, householdId: string, names: readonly string[]): Promise<string[]> {
  if (names.length === 0) return []
  const load = async () => {
    const rows = await db
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(eq(tags.householdId, householdId))
    return new Map(rows.map((r) => [normalizeText(r.name), r.id]))
  }
  let existing = await load()
  const missing = names.filter((n) => !existing.has(normalizeText(n)))
  if (missing.length) {
    const [first, ...rest] = missing.map((name) =>
      db.insert(tags).values({ householdId, name }).onConflictDoNothing(),
    )
    await db.batch([first!, ...rest])
    existing = await load()
  }
  return names.map((n) => existing.get(normalizeText(n))).filter((id): id is string => Boolean(id))
}
