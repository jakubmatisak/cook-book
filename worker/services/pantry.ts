import { and, eq, isNull } from 'drizzle-orm'
import type { PantryDto } from '../../shared/api'
import type { Db } from '../db/client'
import { ingredients, pantryItems } from '../db/schema'
import { HttpError } from '../errors'

/** Špajza: množina ingrediencií označených „mám doma“ (bez množstiev, tie prídu neskôr). */
export async function pantryIngredientIds(db: Db, householdId: string): Promise<Set<string>> {
  const rows = await db
    .select({ ingredientId: pantryItems.ingredientId })
    .from(pantryItems)
    .where(eq(pantryItems.householdId, householdId))
  return new Set(rows.map((r) => r.ingredientId))
}

export async function getPantry(db: Db, householdId: string): Promise<PantryDto> {
  return { ingredientIds: [...(await pantryIngredientIds(db, householdId))] }
}

async function assertIngredient(db: Db, householdId: string, ingredientId: string) {
  const found = await db
    .select({ id: ingredients.id })
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
}

export async function addToPantry(db: Db, householdId: string, ingredientId: string): Promise<void> {
  await assertIngredient(db, householdId, ingredientId)
  if ((await pantryIngredientIds(db, householdId)).has(ingredientId)) return
  await db.insert(pantryItems).values({ householdId, ingredientId })
}

export async function removeFromPantry(db: Db, householdId: string, ingredientId: string): Promise<void> {
  await db
    .delete(pantryItems)
    .where(and(eq(pantryItems.householdId, householdId), eq(pantryItems.ingredientId, ingredientId)))
}
