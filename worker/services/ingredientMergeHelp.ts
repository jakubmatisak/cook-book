import { and, eq, isNull, sql } from 'drizzle-orm'
import { ignoreKey } from '../../shared/ingredientDuplicates'
import type { UnitCode } from '../../shared/units'
import type { Db } from '../db/client'
import { ingredients, pantryItems, recipeIngredients, recipes, settings } from '../db/schema'

const IGNORED_KEY = 'ingredientMergeIgnored'
/** Najviac toľko ignorovaných návrhov (najstaršie vypadnú). */
const IGNORED_LIMIT = 500

/** Návrhy na zlúčenie, ktoré domácnosť ignoruje (kľúče skupín ingrediencií). */
export async function getMergeIgnored(db: Db, householdId: string): Promise<string[]> {
  const row = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.householdId, householdId), eq(settings.key, IGNORED_KEY)))
    .get()
  return Array.isArray(row?.value) ? (row.value as string[]) : []
}

/** Zapamätá si, že tieto ingrediencie domácnosť zlúčiť nechce. */
export async function addMergeIgnored(db: Db, householdId: string, ids: readonly string[]): Promise<void> {
  const key = ignoreKey(ids)
  const current = await getMergeIgnored(db, householdId)
  if (current.includes(key)) return
  const value = [...current, key].slice(-IGNORED_LIMIT)
  await db
    .insert(settings)
    .values({ householdId, key: IGNORED_KEY, value })
    .onConflictDoUpdate({ target: [settings.householdId, settings.key], set: { value } })
}

/**
 * V akých jednotkách sa ingrediencie domácnosti používajú (recepty a špajza) – pred zlúčením sa upozorní na
 * jednotky, ktoré sa nedajú prepočítať. Cudzie ingrediencie sa vynechajú.
 */
export async function ingredientUnits(
  db: Db,
  householdId: string,
  ids: readonly string[],
): Promise<Record<string, UnitCode[]>> {
  const inIds = (column: typeof recipeIngredients.ingredientId | typeof pantryItems.ingredientId) =>
    sql`${column} in (select value from json_each(${JSON.stringify(ids)}))`
  const [fromRecipes, fromPantry] = await db.batch([
    db
      .selectDistinct({ id: recipeIngredients.ingredientId, unit: recipeIngredients.unit })
      .from(recipeIngredients)
      .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
      .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
      .where(
        and(
          inIds(recipeIngredients.ingredientId),
          eq(ingredients.householdId, householdId),
          isNull(recipes.deletedAt),
        ),
      ),
    db
      .selectDistinct({ id: pantryItems.ingredientId, unit: pantryItems.unit })
      .from(pantryItems)
      .where(and(eq(pantryItems.householdId, householdId), inIds(pantryItems.ingredientId))),
  ])
  const result: Record<string, UnitCode[]> = {}
  for (const { id, unit } of [...fromRecipes, ...fromPantry]) {
    if (!unit) continue
    result[id] = [...new Set([...(result[id] ?? []), unit])].sort()
  }
  return result
}
