import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { BulkAffectedDto, IngredientBulkDeleteResult } from '../../shared/api'
import type { IngredientBulkUpdate, RecipeBulkUpdate } from '../../shared/schemas/bulk'
import { normalizeText } from '../../shared/text'
import type { Db } from '../db/client'
import {
  ingredients,
  mealPlanEntries,
  memberPreferences,
  pantryItems,
  recipeFavorites,
  recipeTags,
  recipes,
  stapleItems,
  tags,
} from '../db/schema'
import type { UserRow } from '../env'
import { chunk } from '../http'
import { assertShopCategory, resolveTags } from './catalog'

/** Dvojice (recept, štítok či človek) po dávkach, aby sa nepresiahol limit viazaných hodnôt D1 (100 na dopyt). */
const PAIRS_PER_INSERT = 40

const liveRecipes = (householdId: string, ids: string[]) =>
  and(eq(recipes.householdId, householdId), isNull(recipes.deletedAt), inArray(recipes.id, ids))

/** Zmaže vybrané recepty domácnosti aj ich záznamy v jedálničku; cudzie a neexistujúce id sa preskočia. */
export async function bulkDeleteRecipes(
  db: Db,
  householdId: string,
  ids: string[],
): Promise<BulkAffectedDto> {
  const [deleted] = await db.batch([
    db
      .update(recipes)
      .set({ deletedAt: new Date().toISOString() })
      .where(liveRecipes(householdId, ids))
      .returning({ id: recipes.id }),
    db.delete(mealPlanEntries).where(
      and(
        eq(mealPlanEntries.householdId, householdId),
        inArray(mealPlanEntries.recipeId, ids),
        // záznamy len tých receptov, ktoré skutočne patria domácnosti
        sql`exists (select 1 from recipes r where r.id = ${mealPlanEntries.recipeId} and r.household_id = ${householdId})`,
      ),
    ),
  ])
  return { affected: deleted.length }
}

/**
 * Hromadná úprava receptov: typ jedla, viditeľnosť, pridanie a odobratie štítkov, obľúbené (len pre prihláseného).
 * Vynechané polia sa nemenia. Vracia počet receptov domácnosti, ktorých sa úprava týkala.
 */
export async function bulkUpdateRecipes(
  db: Db,
  user: UserRow,
  input: RecipeBulkUpdate,
): Promise<BulkAffectedDto> {
  const live = (
    await db.select({ id: recipes.id }).from(recipes).where(liveRecipes(user.householdId, input.ids))
  ).map((r) => r.id)
  if (live.length === 0) return { affected: 0 }

  if (input.category !== undefined || input.visibility !== undefined) {
    await db
      .update(recipes)
      .set({
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(liveRecipes(user.householdId, live))
  }

  if (input.addTags?.length) {
    const tagIds = await resolveTags(db, user.householdId, input.addTags)
    const pairs = live.flatMap((recipeId) => tagIds.map((tagId) => ({ recipeId, tagId })))
    for (const part of chunk(pairs, PAIRS_PER_INSERT)) {
      await db.insert(recipeTags).values(part).onConflictDoNothing()
    }
  }

  if (input.removeTags?.length) {
    const wanted = new Set(input.removeTags.map(normalizeText))
    const existing = await db
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(eq(tags.householdId, user.householdId))
    const tagIds = existing.filter((t) => wanted.has(normalizeText(t.name))).map((t) => t.id)
    if (tagIds.length) {
      await db
        .delete(recipeTags)
        .where(and(inArray(recipeTags.recipeId, live), inArray(recipeTags.tagId, tagIds)))
    }
  }

  if (input.favorite === true) {
    for (const part of chunk(live, PAIRS_PER_INSERT)) {
      await db
        .insert(recipeFavorites)
        .values(part.map((recipeId) => ({ recipeId, userId: user.id })))
        .onConflictDoNothing()
    }
  } else if (input.favorite === false) {
    await db
      .delete(recipeFavorites)
      .where(and(eq(recipeFavorites.userId, user.id), inArray(recipeFavorites.recipeId, live)))
  }

  return { affected: live.length }
}

const liveIngredients = (householdId: string, ids: string[]) =>
  and(eq(ingredients.householdId, householdId), isNull(ingredients.deletedAt), inArray(ingredients.id, ids))

/** Hromadná zmena kategórie obchodu a predvolenej jednotky ingrediencií domácnosti. */
export async function bulkUpdateIngredients(
  db: Db,
  householdId: string,
  input: IngredientBulkUpdate,
): Promise<BulkAffectedDto> {
  await assertShopCategory(db, householdId, input.shopCategoryId)
  const patch: Partial<typeof ingredients.$inferInsert> = { updatedAt: new Date().toISOString() }
  if (input.shopCategoryId !== undefined) patch.shopCategoryId = input.shopCategoryId
  if (input.defaultUnit !== undefined) patch.defaultUnit = input.defaultUnit
  const changed = await db
    .update(ingredients)
    .set(patch)
    .where(liveIngredients(householdId, input.ids))
    .returning({ id: ingredients.id })
  return { affected: changed.length }
}

/**
 * Zmaže nepoužité ingrediencie (aj ich zásobu, stále položky a averzie). Ingrediencie použité v receptoch
 * sa preskočia a ich názvy sa vrátia, aby sa dalo povedať prečo.
 */
export async function bulkDeleteIngredients(
  db: Db,
  householdId: string,
  ids: string[],
): Promise<IngredientBulkDeleteResult> {
  const rows = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      usage: sql<number>`(
        select count(*) from recipe_ingredients ri
        join recipes r on r.id = ri.recipe_id
        where ri.ingredient_id = "ingredients"."id" and r.deleted_at is null
      )`.mapWith(Number),
    })
    .from(ingredients)
    .where(liveIngredients(householdId, ids))
  const free = rows.filter((r) => r.usage === 0).map((r) => r.id)
  const skipped = rows.filter((r) => r.usage > 0).map((r) => r.name)
  if (free.length) {
    await db.batch([
      db.delete(pantryItems).where(inArray(pantryItems.ingredientId, free)),
      db.delete(stapleItems).where(inArray(stapleItems.ingredientId, free)),
      db.delete(memberPreferences).where(inArray(memberPreferences.ingredientId, free)),
      db
        .update(ingredients)
        .set({ deletedAt: new Date().toISOString() })
        .where(liveIngredients(householdId, free)),
    ])
  }
  return { deleted: free.length, skipped }
}
