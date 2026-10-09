import { and, between, eq, inArray, isNotNull, lt, gte } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { composePlan, type ComposeItem } from '../../shared/compose'
import { addDays } from '../../shared/dates'
import { newId } from '../../shared/ids'
import { entryPortions } from '../../shared/portions'
import type { ComposeApplyInput, ComposeRequestInput } from '../../shared/schemas/plan'
import type { Db } from '../db/client'
import { cookLog, mealPlanEntries, mealSlots, recipes } from '../db/schema'
import { HttpError } from '../errors'
import { chunk } from '../http'
import { listMembers } from './family'
import { listStays, stayGuestsOn } from './stays'
import { loadCandidates, pantryIngredientIds } from './suggestions'

/** Koľko dní pred rozsahom sa uvarené alebo naplánované hlavné jedlá znova nenavrhujú. */
const RECENT_DAYS = 3

async function assertSlots(db: Db, householdId: string, slotIds: readonly string[]) {
  const unique = [...new Set(slotIds)]
  const rows = await db
    .select({ id: mealSlots.id })
    .from(mealSlots)
    .where(and(eq(mealSlots.householdId, householdId), inArray(mealSlots.id, unique)))
  if (rows.length !== unique.length) throw new HttpError(400, 'invalid_slot', 'Jedlo dňa neexistuje.')
}

const cellKey = (date: string, slotId: string) => `${date}|${slotId}`

/** Návrh jedálnička pre vymaľované políčka; nič sa neukladá. */
export async function composeProposal(
  db: Db,
  householdId: string,
  userId: string,
  input: ComposeRequestInput,
): Promise<ComposeItem[]> {
  await assertSlots(db, householdId, [
    ...input.slots.map((s) => s.slotId),
    ...input.cells.map((c) => c.slotId),
  ])
  const dates = input.cells.map((c) => c.date).sort()
  const from = dates[0]!
  const to = dates[dates.length - 1]!

  const [candidates, pantry, members, stays, planned, cooked] = await Promise.all([
    loadCandidates(db, householdId, userId),
    pantryIngredientIds(db, householdId, from),
    listMembers(db, householdId),
    listStays(db, householdId, from, to),
    db
      .select({
        date: mealPlanEntries.date,
        slotId: mealPlanEntries.slotId,
        recipeId: mealPlanEntries.recipeId,
      })
      .from(mealPlanEntries)
      .where(
        and(
          eq(mealPlanEntries.householdId, householdId),
          isNotNull(mealPlanEntries.recipeId),
          between(mealPlanEntries.date, addDays(from, -RECENT_DAYS), to),
        ),
      ),
    db
      .select({ recipeId: cookLog.recipeId })
      .from(cookLog)
      .innerJoin(recipes, eq(recipes.id, cookLog.recipeId))
      .where(
        and(
          eq(recipes.householdId, householdId),
          gte(cookLog.cookedOn, addDays(from, -RECENT_DAYS)),
          lt(cookLog.cookedOn, from),
        ),
      ),
  ])

  // Pri nahradení sa obsah vymaľovaných políčok neráta ako „už máme“.
  const painted = new Set(input.cells.map((c) => cellKey(c.date, c.slotId)))
  const inRange = planned.filter(
    (p) => p.date >= from && !(input.replace && painted.has(cellKey(p.date, p.slotId))),
  )
  const guestsOn = Object.fromEntries(dates.map((d) => [d, stayGuestsOn(stays, d)]))

  return composePlan(input, {
    candidates,
    pantryIngredientIds: pantry,
    members,
    guestsOn,
    existing: inRange.map((p) => ({ date: p.date, slotId: p.slotId, recipeId: p.recipeId! })),
    recentRecipeIds: [
      ...planned.filter((p) => p.date < from).map((p) => p.recipeId!),
      ...cooked.map((c) => c.recipeId),
    ],
    today: from,
  })
}

/**
 * Uloží potvrdený návrh: varenie s porciami na viac dní (porcie rodiny v ten deň × (1 + dni zvyškov)) a zvyšky
 * naviazané na varenie. S `replace` sa najprv vyprázdnia vymaľované políčka.
 */
export async function applyComposition(
  db: Db,
  householdId: string,
  input: ComposeApplyInput,
): Promise<number> {
  await assertSlots(
    db,
    householdId,
    input.items.map((i) => i.slotId),
  )
  const recipeIds = [...new Set(input.items.map((i) => i.recipeId))]
  const servingsOf = new Map<string, number>()
  for (const ids of chunk(recipeIds, 90)) {
    const rows = await db
      .select({ id: recipes.id, servings: recipes.servings })
      .from(recipes)
      .where(and(eq(recipes.householdId, householdId), inArray(recipes.id, ids)))
    for (const r of rows) servingsOf.set(r.id, r.servings)
  }
  if (servingsOf.size !== recipeIds.length) throw new HttpError(400, 'invalid_recipe', 'Recept neexistuje.')
  const keys = new Set(input.items.map((i) => i.key))
  if (input.items.some((i) => i.leftoverOf !== null && !keys.has(i.leftoverOf))) {
    throw new HttpError(400, 'invalid_leftover', 'Zvyšky nemajú varenie.')
  }

  const dates = input.items.map((i) => i.date).sort()
  const [members, stays] = await Promise.all([
    listMembers(db, householdId),
    listStays(db, householdId, dates[0]!, dates[dates.length - 1]!),
  ])

  const ids = new Map(input.items.map((i) => [i.key, newId()]))
  const order = new Map<string, number>()
  const rows = input.items.map((item) => {
    const cell = cellKey(item.date, item.slotId)
    const sortOrder = order.get(cell) ?? 0
    order.set(cell, sortOrder + 1)
    const cooking = item.leftoverOf === null && item.leftoverDays > 0
    const base = cooking
      ? (entryPortions(
          { servingsOverride: null, audience: 'all', guestIds: stayGuestsOn(stays, item.date) },
          members,
        ) ?? servingsOf.get(item.recipeId)!)
      : null
    return {
      id: ids.get(item.key)!,
      householdId,
      date: item.date,
      slotId: item.slotId,
      recipeId: item.recipeId,
      servingsOverride: base === null ? null : base * (1 + item.leftoverDays),
      leftoverOfEntryId: item.leftoverOf === null ? null : ids.get(item.leftoverOf)!,
      sortOrder,
    }
  })

  const statements: BatchItem<'sqlite'>[] = []
  if (input.replace) {
    for (const cell of new Set(input.items.map((i) => cellKey(i.date, i.slotId)))) {
      const [date, slotId] = cell.split('|') as [string, string]
      statements.push(
        db
          .delete(mealPlanEntries)
          .where(
            and(
              eq(mealPlanEntries.householdId, householdId),
              eq(mealPlanEntries.date, date),
              eq(mealPlanEntries.slotId, slotId),
            ),
          ),
      )
    }
  }
  // Najprv varenie, potom zvyšky (odkaz na varenie musí existovať); 9 stĺpcov na riadok, limit D1 100 parametrov.
  const ordered = [...rows.filter((r) => !r.leftoverOfEntryId), ...rows.filter((r) => r.leftoverOfEntryId)]
  for (const part of chunk(ordered, 10)) statements.push(db.insert(mealPlanEntries).values(part))
  const [first, ...rest] = statements
  await db.batch([first!, ...rest])
  return rows.length
}
