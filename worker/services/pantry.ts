import { and, asc, eq, isNull } from 'drizzle-orm'
import type { PantryDto, PantryItemDto } from '../../shared/api'
import type { PantryItemInput } from '../../shared/schemas/pantry'
import type { Db } from '../db/client'
import { ingredients, pantryItems, shopCategories } from '../db/schema'
import { HttpError } from '../errors'
import { normalizeText } from '../../shared/text'
import { getSettings } from './family'

type PantryRow = typeof pantryItems.$inferSelect

const toDto = (row: PantryRow, name: string): PantryItemDto => ({
  id: row.id,
  ingredientId: row.ingredientId,
  name,
  quantity: row.quantity,
  unit: row.unit,
  expiresOn: row.expiresOn,
  location: row.location,
})

/** Špajza: množina ingrediencií, ktoré máme doma (s množstvom alebo bez). */
export async function pantryIngredientIds(db: Db, householdId: string): Promise<Set<string>> {
  const rows = await db
    .select({ ingredientId: pantryItems.ingredientId })
    .from(pantryItems)
    .where(eq(pantryItems.householdId, householdId))
  return new Set(rows.map((r) => r.ingredientId))
}

/**
 * Kategórie obchodu, ktorých suroviny sa pri hodnotení receptov podľa špajze nepočítajú ako chýbajúce.
 * Po zapnutí nastavenia „ignorovať koreniny“ ide o kategóriu, ktorej názov obsahuje „korenin“
 * (predvolene Koreniny a dochucovadlá); ak ju domácnosť premenovala, nič sa neignoruje.
 */
export async function ignoredPantryCategoryIds(db: Db, householdId: string): Promise<Set<string>> {
  if ((await getSettings(db, householdId)).ignoreSpicesInPantry !== true) return new Set()
  const rows = await db
    .select({ id: shopCategories.id, name: shopCategories.name })
    .from(shopCategories)
    .where(eq(shopCategories.householdId, householdId))
  return new Set(rows.filter((r) => normalizeText(r.name).includes('korenin')).map((r) => r.id))
}

/** Zásoby s názvami ingrediencií, zoradené podľa názvu. */
export async function listPantryItems(db: Db, householdId: string): Promise<PantryItemDto[]> {
  const rows = await db
    .select({ row: pantryItems, name: ingredients.name })
    .from(pantryItems)
    .innerJoin(ingredients, eq(ingredients.id, pantryItems.ingredientId))
    .where(eq(pantryItems.householdId, householdId))
    .orderBy(asc(ingredients.nameNormalized))
  return rows.map(({ row, name }) => toDto(row, name))
}

export async function getPantry(db: Db, householdId: string): Promise<PantryDto> {
  const [ids, items] = await Promise.all([
    pantryIngredientIds(db, householdId),
    listPantryItems(db, householdId),
  ])
  return { ingredientIds: [...ids], items }
}

async function findIngredient(db: Db, householdId: string, ingredientId: string) {
  const found = await db
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(
      and(
        eq(ingredients.id, ingredientId),
        eq(ingredients.householdId, householdId),
        isNull(ingredients.deletedAt),
      ),
    )
    .get()
  if (!found) throw new HttpError(404, 'not_found', 'Ingrediencia neexistuje.')
  return found
}

const findRow = (db: Db, householdId: string, ingredientId: string) =>
  db
    .select()
    .from(pantryItems)
    .where(and(eq(pantryItems.householdId, householdId), eq(pantryItems.ingredientId, ingredientId)))
    .get()

/** Označí ingredienciu ako „mám doma“; existujúci záznam s množstvom ostane nedotknutý. */
export async function addToPantry(db: Db, householdId: string, ingredientId: string): Promise<void> {
  await findIngredient(db, householdId, ingredientId)
  if (await findRow(db, householdId, ingredientId)) return
  await db.insert(pantryItems).values({ householdId, ingredientId })
}

/** Uloží zásobu (množstvo, jednotku, trvanlivosť, miesto); jedna ingrediencia má jeden záznam. */
export async function savePantryItem(
  db: Db,
  householdId: string,
  ingredientId: string,
  input: PantryItemInput,
): Promise<PantryItemDto> {
  const ingredient = await findIngredient(db, householdId, ingredientId)
  const existing = await findRow(db, householdId, ingredientId)
  const [row] = existing
    ? await db.update(pantryItems).set(input).where(eq(pantryItems.id, existing.id)).returning()
    : await db
        .insert(pantryItems)
        .values({ householdId, ingredientId, ...input })
        .returning()
  return toDto(row!, ingredient.name)
}

export async function removeFromPantry(db: Db, householdId: string, ingredientId: string): Promise<void> {
  await db
    .delete(pantryItems)
    .where(and(eq(pantryItems.householdId, householdId), eq(pantryItems.ingredientId, ingredientId)))
}
