import { eq, inArray, type SQL } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { BatchItem } from 'drizzle-orm/batch'
import { EXPORT_TABLES, type ExportFile, type ExportTableName } from '../../shared/api'
import type { Db } from '../db/client'
import * as t from '../db/schema'

/** Všetky dáta jednej domácnosti v jednom D1 batchi (jeden round-trip). */
export async function exportHousehold(db: Db, householdId: string): Promise<ExportFile> {
  const own = (col: SQLiteColumn): SQL => eq(col, householdId)

  const recipeIds = db.select({ id: t.recipes.id }).from(t.recipes).where(own(t.recipes.householdId))
  const memberIds = db.select({ id: t.familyMembers.id }).from(t.familyMembers).where(own(t.familyMembers.householdId))
  const entryIds = db
    .select({ id: t.mealPlanEntries.id })
    .from(t.mealPlanEntries)
    .where(own(t.mealPlanEntries.householdId))
  const templateIds = db
    .select({ id: t.weekTemplates.id })
    .from(t.weekTemplates)
    .where(own(t.weekTemplates.householdId))
  const listIds = db.select({ id: t.shoppingLists.id }).from(t.shoppingLists).where(own(t.shoppingLists.householdId))
  const itemIds = db.select({ id: t.shoppingItems.id }).from(t.shoppingItems).where(inArray(t.shoppingItems.listId, listIds))

  const queries = {
    households: db.select().from(t.households).where(eq(t.households.id, householdId)),
    users: db.select().from(t.users).where(own(t.users.householdId)),
    familyMembers: db.select().from(t.familyMembers).where(own(t.familyMembers.householdId)),
    shopCategories: db.select().from(t.shopCategories).where(own(t.shopCategories.householdId)),
    ingredients: db.select().from(t.ingredients).where(own(t.ingredients.householdId)),
    tags: db.select().from(t.tags).where(own(t.tags.householdId)),
    memberPreferences: db.select().from(t.memberPreferences).where(inArray(t.memberPreferences.memberId, memberIds)),
    images: db.select().from(t.images).where(own(t.images.householdId)),
    recipes: db.select().from(t.recipes).where(own(t.recipes.householdId)),
    recipeIngredients: db.select().from(t.recipeIngredients).where(inArray(t.recipeIngredients.recipeId, recipeIds)),
    recipeSteps: db.select().from(t.recipeSteps).where(inArray(t.recipeSteps.recipeId, recipeIds)),
    recipeTags: db.select().from(t.recipeTags).where(inArray(t.recipeTags.recipeId, recipeIds)),
    recipeFavorites: db.select().from(t.recipeFavorites).where(inArray(t.recipeFavorites.recipeId, recipeIds)),
    recipeRatings: db.select().from(t.recipeRatings).where(inArray(t.recipeRatings.recipeId, recipeIds)),
    recipeNotes: db.select().from(t.recipeNotes).where(inArray(t.recipeNotes.recipeId, recipeIds)),
    mealSlots: db.select().from(t.mealSlots).where(own(t.mealSlots.householdId)),
    mealPlanEntries: db.select().from(t.mealPlanEntries).where(own(t.mealPlanEntries.householdId)),
    mealPlanEntryMembers: db
      .select()
      .from(t.mealPlanEntryMembers)
      .where(inArray(t.mealPlanEntryMembers.entryId, entryIds)),
    cookLog: db.select().from(t.cookLog).where(inArray(t.cookLog.recipeId, recipeIds)),
    weekTemplates: db.select().from(t.weekTemplates).where(own(t.weekTemplates.householdId)),
    weekTemplateEntries: db
      .select()
      .from(t.weekTemplateEntries)
      .where(inArray(t.weekTemplateEntries.templateId, templateIds)),
    shoppingLists: db.select().from(t.shoppingLists).where(own(t.shoppingLists.householdId)),
    shoppingItems: db.select().from(t.shoppingItems).where(inArray(t.shoppingItems.listId, listIds)),
    shoppingItemSources: db
      .select()
      .from(t.shoppingItemSources)
      .where(inArray(t.shoppingItemSources.itemId, itemIds)),
    stapleItems: db.select().from(t.stapleItems).where(own(t.stapleItems.householdId)),
    pantryItems: db.select().from(t.pantryItems).where(own(t.pantryItems.householdId)),
    settings: db.select().from(t.settings).where(own(t.settings.householdId)),
  } satisfies Record<ExportTableName, BatchItem<'sqlite'>>

  const statements = EXPORT_TABLES.map((name) => queries[name]) as unknown as [
    BatchItem<'sqlite'>,
    ...BatchItem<'sqlite'>[],
  ]
  const results = (await db.batch(statements)) as unknown[][]

  const tables = Object.fromEntries(EXPORT_TABLES.map((name, i) => [name, results[i] ?? []])) as Record<
    ExportTableName,
    unknown[]
  >

  return {
    format: 'kucharska-kniha-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    householdId,
    tables,
  }
}
