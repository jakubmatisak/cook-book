import { and, asc, between, eq, inArray, isNotNull, isNull, ne, or, gte } from 'drizzle-orm'
import type { ComposeCandidate } from '../../shared/compose'
import { addDays } from '../../shared/dates'
import { scoreSuggestions, type Suggestion } from '../../shared/suggest'
import type { Db } from '../db/client'
import {
  images,
  ingredients,
  mealPlanEntries,
  pantryItems,
  recipeIngredients,
  recipes,
  recipeTags,
} from '../db/schema'
import { chunk } from '../http'
import { listMembers } from './family'
import { ignoredPantryCategoryIds } from './pantry'
import { imageUrl, isFavoriteSql, lastCookedSql } from './recipes'

/** Koľko dní okolo zvoleného dňa sa už naplánovaný recept nenavrhuje. */
const PLANNED_WINDOW_DAYS = 3

/**
 * Recepty domácnosti s údajmi na hodnotenie návrhov (ingrediencie, tagy, posledné varenie, obľúbené). Detské jedlá
 * (kaše, príkrmy) sa do návrhov nepoužívajú.
 */
export async function loadCandidates(
  db: Db,
  householdId: string,
  userId: string,
): Promise<ComposeCandidate[]> {
  const rows = await db
    .select({
      recipe: recipes,
      r2Key: images.r2Key,
      isFavorite: isFavoriteSql(userId),
      lastCookedAt: lastCookedSql,
    })
    .from(recipes)
    .leftJoin(images, eq(images.id, recipes.coverImageId))
    .where(
      and(eq(recipes.householdId, householdId), isNull(recipes.deletedAt), ne(recipes.category, 'detske')),
    )
    .orderBy(asc(recipes.titleNormalized))
  if (rows.length === 0) return []

  // Koreniny (ak je to zapnuté v nastaveniach) sa nepočítajú ako chýbajúce.
  const ignored = await ignoredPantryCategoryIds(db, householdId)
  const required = new Map<string, { id: string; name: string }[]>()
  const allIngredients = new Map<string, string[]>()
  const tagsOf = new Map<string, string[]>()
  for (const ids of chunk(
    rows.map((r) => r.recipe.id),
    90,
  )) {
    const [ingredientRows, tagRows] = await db.batch([
      db
        .select({
          recipeId: recipeIngredients.recipeId,
          ingredientId: recipeIngredients.ingredientId,
          name: ingredients.name,
          isOptional: recipeIngredients.isOptional,
          shopCategoryId: ingredients.shopCategoryId,
        })
        .from(recipeIngredients)
        .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
        .where(inArray(recipeIngredients.recipeId, ids))
        .orderBy(asc(recipeIngredients.sortOrder)),
      db
        .select({ recipeId: recipeTags.recipeId, tagId: recipeTags.tagId })
        .from(recipeTags)
        .where(inArray(recipeTags.recipeId, ids)),
    ])
    for (const r of ingredientRows) {
      allIngredients.set(r.recipeId, [...(allIngredients.get(r.recipeId) ?? []), r.ingredientId])
      if (!r.isOptional && !(r.shopCategoryId && ignored.has(r.shopCategoryId))) {
        const list = required.get(r.recipeId) ?? []
        if (!list.some((i) => i.id === r.ingredientId)) list.push({ id: r.ingredientId, name: r.name })
        required.set(r.recipeId, list)
      }
    }
    for (const r of tagRows) tagsOf.set(r.recipeId, [...(tagsOf.get(r.recipeId) ?? []), r.tagId])
  }

  return rows.map(({ recipe, r2Key, isFavorite, lastCookedAt }) => ({
    id: recipe.id,
    title: recipe.title,
    coverImageUrl: r2Key ? imageUrl(r2Key) : null,
    isFavorite,
    isVerified: recipe.isVerified,
    category: recipe.category,
    alsoCategories: recipe.alsoCategories,
    totalMinutes:
      recipe.prepMinutes === null && recipe.cookMinutes === null
        ? null
        : (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0),
    required: required.get(recipe.id) ?? [],
    allIngredientIds: allIngredients.get(recipe.id) ?? [],
    tagIds: tagsOf.get(recipe.id) ?? [],
    lastCookedOn: lastCookedAt,
  }))
}

/** Čo je doma k danému dňu (exspirovaná zásoba sa nepočíta). */
export async function pantryIngredientIds(db: Db, householdId: string, date: string): Promise<string[]> {
  const rows = await db
    .select({ ingredientId: pantryItems.ingredientId })
    .from(pantryItems)
    .where(
      and(
        eq(pantryItems.householdId, householdId),
        or(isNull(pantryItems.expiresOn), gte(pantryItems.expiresOn, date)),
      ),
    )
  return rows.map((r) => r.ingredientId)
}

/**
 * Čo uvariť v daný deň: recepty domácnosti ohodnotené podľa toho, čo je doma, kedy sa naposledy
 * varilo, obľúbenosti a preferencií rodiny. Naplánované recepty a alergény sa vynechajú.
 */
export async function suggestRecipes(
  db: Db,
  householdId: string,
  userId: string,
  date: string,
): Promise<Suggestion[]> {
  const candidates = await loadCandidates(db, householdId, userId)
  if (candidates.length === 0) return []

  const [pantry, plannedRows, members] = await Promise.all([
    pantryIngredientIds(db, householdId, date),
    db
      .select({ recipeId: mealPlanEntries.recipeId })
      .from(mealPlanEntries)
      .where(
        and(
          eq(mealPlanEntries.householdId, householdId),
          isNotNull(mealPlanEntries.recipeId),
          between(
            mealPlanEntries.date,
            addDays(date, -PLANNED_WINDOW_DAYS),
            addDays(date, PLANNED_WINDOW_DAYS),
          ),
        ),
      ),
    listMembers(db, householdId),
  ])

  return scoreSuggestions({
    candidates,
    pantryIngredientIds: pantry,
    plannedRecipeIds: plannedRows.flatMap((p) => (p.recipeId ? [p.recipeId] : [])),
    members,
    today: date,
  })
}
