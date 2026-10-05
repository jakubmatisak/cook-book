import { and, eq, isNotNull, isNull, lt } from 'drizzle-orm'
import { newId } from '../../shared/ids'
import type { Db } from '../db/client'
import { cookLog, mealPlanEntries, recipes } from '../db/schema'
import { chunk } from '../http'

/**
 * „Uvarené“ sa odvodzuje z jedálnička: záznam s receptom a dňom pred dneškom je uvarený.
 * Doplní chýbajúce riadky do `cook_log`; opakované volanie nič nemení.
 * Vráti počet nových záznamov.
 */
export async function backfillCookLog(db: Db, householdId: string, today: string): Promise<number> {
  const missing = await db
    .select({
      entryId: mealPlanEntries.id,
      recipeId: mealPlanEntries.recipeId,
      date: mealPlanEntries.date,
      servings: mealPlanEntries.servingsOverride,
    })
    .from(mealPlanEntries)
    .innerJoin(recipes, and(eq(recipes.id, mealPlanEntries.recipeId), isNull(recipes.deletedAt)))
    .leftJoin(cookLog, eq(cookLog.planEntryId, mealPlanEntries.id))
    .where(
      and(
        eq(mealPlanEntries.householdId, householdId),
        isNotNull(mealPlanEntries.recipeId),
        lt(mealPlanEntries.date, today),
        isNull(cookLog.id),
      ),
    )
  // 5 stĺpcov na riadok a limit D1 100 parametrov na dotaz.
  for (const part of chunk(missing, 18)) {
    await db.insert(cookLog).values(
      part.map((m) => ({
        id: newId(),
        recipeId: m.recipeId!,
        cookedOn: m.date,
        planEntryId: m.entryId,
        servings: m.servings,
      })),
    )
  }
  return missing.length
}
