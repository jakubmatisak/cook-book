import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { IngredientDto, StarterIngredientsResult } from '../../shared/api'
import { STARTER_INGREDIENTS } from '../../shared/data/starterIngredients'
import { newId } from '../../shared/ids'
import { plural } from '../../shared/format'
import { normalizeText } from '../../shared/text'
import type { UnitCode } from '../../shared/units'
import type { Db } from '../db/client'
import {
  ingredients,
  memberPreferences,
  pantryItems,
  settings,
  shopCategories,
  stapleItems,
  tags,
} from '../db/schema'
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
 * Zmaže ingredienciu zo zoznamu (označí ju za zmazanú, takže ju neskôr obnoví rovnaký názov) aj jej
 * zásobu, stále položky a alergie či averzie. Ingredienciu použitú v receptoch nezmaže: tú treba
 * najprv odstrániť z receptov, alebo ju stačí premenovať.
 */
export async function deleteIngredient(db: Db, householdId: string, id: string): Promise<void> {
  const found = await getIngredientDto(db, householdId, id)
  if (found.usageCount > 0) {
    throw new HttpError(
      409,
      'in_use',
      `Ingrediencia „${found.name}“ sa používa v ${plural(found.usageCount, 'recepte', 'receptoch', 'receptoch')}. Najprv ju odstráň z receptov, alebo ju premenuj.`,
    )
  }
  await db.batch([
    db.delete(pantryItems).where(eq(pantryItems.ingredientId, id)),
    db.delete(stapleItems).where(eq(stapleItems.ingredientId, id)),
    db.delete(memberPreferences).where(eq(memberPreferences.ingredientId, id)),
    db.update(ingredients).set({ deletedAt: new Date().toISOString() }).where(eq(ingredients.id, id)),
  ])
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

/**
 * Pridá štartovací zoznam surovín jedným príkazom (JSON → `insert or ignore ... select`): existujúce
 * suroviny sa podľa názvu bez diakritiky (aj zmazané) preskočia a nič sa neprepíše. Kategória sa nájde
 * podľa názvu medzi kategóriami obchodu tej istej domácnosti.
 */
export async function addStarterIngredients(db: Db, householdId: string): Promise<StarterIngredientsResult> {
  const payload = JSON.stringify(
    STARTER_INGREDIENTS.map((i) => ({
      id: newId(),
      name: i.name,
      norm: normalizeText(i.name),
      unit: i.unit,
      category: i.category,
    })),
  )
  const now = new Date().toISOString()
  await db.run(sql`
    insert or ignore into ingredients
      (id, household_id, name, name_normalized, default_unit, shop_category_id, aliases, created_at, updated_at)
    select
      json_extract(j.value, '$.id'),
      ${householdId},
      json_extract(j.value, '$.name'),
      json_extract(j.value, '$.norm'),
      json_extract(j.value, '$.unit'),
      (select c.id from shop_categories c
        where c.household_id = ${householdId} and c.name = json_extract(j.value, '$.category')),
      '[]',
      ${now},
      ${now}
    from json_each(${payload}) j`)
  // Pridané sú práve tie riadky, ktorých id sme poslali (preskočené nemajú naše id).
  const rows = await db.all<{
    id: string
    name: string
    defaultUnit: UnitCode | null
    shopCategoryId: string | null
  }>(sql`
    select i.id as id, i.name as name, i.default_unit as defaultUnit, i.shop_category_id as shopCategoryId
    from ingredients i
    join json_each(${payload}) j on i.id = json_extract(j.value, '$.id')
    where i.household_id = ${householdId}
    order by i.name_normalized`)
  // Príznak, že sa zoznam pridal; aplikácia ho potom pri ďalšom načítaní už nepridáva sama.
  await db
    .insert(settings)
    .values({ householdId, key: 'starterIngredientsAdded', value: true })
    .onConflictDoUpdate({ target: [settings.householdId, settings.key], set: { value: true } })
  const items: IngredientDto[] = rows.map((r) => ({ ...r, usageCount: 0 }))
  return { added: items.length, total: STARTER_INGREDIENTS.length, items }
}
