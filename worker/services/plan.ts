import { and, asc, between, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { PlanEntryDto } from '../../shared/api'
import { preferenceConflicts } from '../../shared/preferences'
import { addDays, daysBetween } from '../../shared/dates'
import { newId } from '../../shared/ids'
import type { PlanCopyInput, PlanEntryInput } from '../../shared/schemas/plan'
import type { Db } from '../db/client'
import { images, mealPlanEntries, mealSlots, recipeIngredients, recipes, recipeTags } from '../db/schema'
import { HttpError } from '../errors'
import { chunk } from '../http'
import { listMembers } from './family'
import { imageUrl } from './recipes'

type EntryRow = typeof mealPlanEntries.$inferSelect

const entryColumns = {
  entry: mealPlanEntries,
  recipeTitle: recipes.title,
  recipeServings: recipes.servings,
  recipeDeletedAt: recipes.deletedAt,
  r2Key: images.r2Key,
}

function selectEntries(db: Db) {
  return db
    .select(entryColumns)
    .from(mealPlanEntries)
    .innerJoin(mealSlots, eq(mealSlots.id, mealPlanEntries.slotId))
    .leftJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
    .leftJoin(images, eq(images.id, recipes.coverImageId))
}

type JoinedRow = Awaited<ReturnType<ReturnType<typeof selectEntries>['all']>>[number]

type EntryBase = Omit<PlanEntryDto, 'warnings'>

function toEntryDto(row: JoinedRow): EntryBase {
  const e = row.entry
  return {
    id: e.id,
    date: e.date,
    slotId: e.slotId,
    recipeId: e.recipeId,
    recipe:
      e.recipeId && row.recipeTitle !== null
        ? {
            id: e.recipeId,
            title: row.recipeTitle,
            servings: row.recipeServings ?? 1,
            coverImageUrl: row.r2Key ? imageUrl(row.r2Key) : null,
            deleted: row.recipeDeletedAt !== null,
          }
        : null,
    freeText: e.freeText,
    servingsOverride: e.servingsOverride,
    note: e.note,
    sortOrder: e.sortOrder,
    audience: e.audience,
  }
}

/**
 * Upozornenia pre rodinu (alergie, averzie, diéty) ku každému jedlu s receptom.
 * Bez jedinej preferencie v rodine sa nič ďalšie nenačítava.
 */
async function attachWarnings(db: Db, householdId: string, entries: EntryBase[]): Promise<PlanEntryDto[]> {
  const members = await listMembers(db, householdId)
  if (!members.some((m) => m.preferences.length > 0)) return entries.map((e) => ({ ...e, warnings: [] }))

  const recipeIds = [...new Set(entries.filter((e) => e.recipe && !e.recipe.deleted).map((e) => e.recipeId!))]
  const ingredientsOf = new Map<string, string[]>()
  const tagsOf = new Map<string, string[]>()
  for (const ids of chunk(recipeIds, 90)) {
    const [ingredientRows, tagRows] = await db.batch([
      db
        .select({ recipeId: recipeIngredients.recipeId, ingredientId: recipeIngredients.ingredientId })
        .from(recipeIngredients)
        .where(inArray(recipeIngredients.recipeId, ids)),
      db
        .select({ recipeId: recipeTags.recipeId, tagId: recipeTags.tagId })
        .from(recipeTags)
        .where(inArray(recipeTags.recipeId, ids)),
    ])
    for (const r of ingredientRows)
      ingredientsOf.set(r.recipeId, [...(ingredientsOf.get(r.recipeId) ?? []), r.ingredientId])
    for (const r of tagRows) tagsOf.set(r.recipeId, [...(tagsOf.get(r.recipeId) ?? []), r.tagId])
  }

  return entries.map((e) => ({
    ...e,
    warnings:
      e.recipe && !e.recipe.deleted
        ? preferenceConflicts(
            { ingredientIds: ingredientsOf.get(e.recipeId!) ?? [], tagIds: tagsOf.get(e.recipeId!) ?? [] },
            members,
            e.audience,
          )
        : [],
  }))
}

export async function listPlan(
  db: Db,
  householdId: string,
  from: string,
  to: string,
): Promise<PlanEntryDto[]> {
  const rows = await selectEntries(db)
    .where(and(eq(mealPlanEntries.householdId, householdId), between(mealPlanEntries.date, from, to)))
    .orderBy(
      asc(mealPlanEntries.date),
      asc(mealSlots.sortOrder),
      asc(mealPlanEntries.sortOrder),
      asc(mealPlanEntries.createdAt),
    )
  return attachWarnings(db, householdId, rows.map(toEntryDto))
}

async function getEntryDto(db: Db, householdId: string, id: string): Promise<PlanEntryDto> {
  const row = await selectEntries(db)
    .where(and(eq(mealPlanEntries.id, id), eq(mealPlanEntries.householdId, householdId)))
    .get()
  if (!row) throw new HttpError(404, 'not_found', 'Jedlo v pláne neexistuje.')
  const [entry] = await attachWarnings(db, householdId, [toEntryDto(row)])
  return entry!
}

async function findEntry(db: Db, householdId: string, id: string): Promise<EntryRow> {
  const row = await db
    .select()
    .from(mealPlanEntries)
    .where(and(eq(mealPlanEntries.id, id), eq(mealPlanEntries.householdId, householdId)))
    .get()
  if (!row) throw new HttpError(404, 'not_found', 'Jedlo v pláne neexistuje.')
  return row
}

async function assertSlot(db: Db, householdId: string, slotId: string) {
  const slot = await db
    .select({ id: mealSlots.id })
    .from(mealSlots)
    .where(and(eq(mealSlots.id, slotId), eq(mealSlots.householdId, householdId)))
    .get()
  if (!slot) throw new HttpError(400, 'invalid_slot', 'Jedlo dňa neexistuje.')
}

async function assertRecipe(db: Db, householdId: string, recipeId: string | null) {
  if (!recipeId) return
  const recipe = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.householdId, householdId), isNull(recipes.deletedAt)))
    .get()
  if (!recipe) throw new HttpError(400, 'invalid_recipe', 'Recept neexistuje.')
}

async function nextSortOrder(db: Db, householdId: string, date: string, slotId: string): Promise<number> {
  const row = await db
    .select({ max: sql<number>`coalesce(max(${mealPlanEntries.sortOrder}), -1)` })
    .from(mealPlanEntries)
    .where(
      and(
        eq(mealPlanEntries.householdId, householdId),
        eq(mealPlanEntries.date, date),
        eq(mealPlanEntries.slotId, slotId),
      ),
    )
    .get()
  return (row?.max ?? -1) + 1
}

export async function createEntry(db: Db, householdId: string, input: PlanEntryInput): Promise<PlanEntryDto> {
  await assertSlot(db, householdId, input.slotId)
  await assertRecipe(db, householdId, input.recipeId)
  const id = newId()
  await db.insert(mealPlanEntries).values({
    id,
    householdId,
    date: input.date,
    slotId: input.slotId,
    recipeId: input.recipeId,
    freeText: input.freeText,
    servingsOverride: input.servingsOverride,
    note: input.note,
    sortOrder: await nextSortOrder(db, householdId, input.date, input.slotId),
  })
  return getEntryDto(db, householdId, id)
}

export async function updateEntry(
  db: Db,
  householdId: string,
  id: string,
  input: PlanEntryInput,
): Promise<PlanEntryDto> {
  const current = await findEntry(db, householdId, id)
  await assertSlot(db, householdId, input.slotId)
  // Ponechaný (aj medzičasom zmazaný) recept je v poriadku, nový musí existovať.
  if (input.recipeId !== current.recipeId) await assertRecipe(db, householdId, input.recipeId)
  const moved = input.date !== current.date || input.slotId !== current.slotId
  await db
    .update(mealPlanEntries)
    .set({
      date: input.date,
      slotId: input.slotId,
      recipeId: input.recipeId,
      freeText: input.freeText,
      servingsOverride: input.servingsOverride,
      note: input.note,
      sortOrder: moved ? await nextSortOrder(db, householdId, input.date, input.slotId) : current.sortOrder,
    })
    .where(eq(mealPlanEntries.id, id))
  return getEntryDto(db, householdId, id)
}

export async function deleteEntry(db: Db, householdId: string, id: string): Promise<void> {
  await findEntry(db, householdId, id)
  await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, id))
}

/** Skopíruje jedlá z `days` dní od `fromDate` na rovnaké dni od `toDate`; `replace` najprv cieľ vyprázdni. */
export async function copyPlan(db: Db, householdId: string, input: PlanCopyInput): Promise<number> {
  const sourceTo = addDays(input.fromDate, input.days - 1)
  const targetTo = addDays(input.toDate, input.days - 1)
  const offset = daysBetween(input.fromDate, input.toDate)
  const own = eq(mealPlanEntries.householdId, householdId)

  const source = await db
    .select()
    .from(mealPlanEntries)
    .where(and(own, between(mealPlanEntries.date, input.fromDate, sourceTo)))
    .orderBy(asc(mealPlanEntries.date), asc(mealPlanEntries.sortOrder), asc(mealPlanEntries.createdAt))
  if (source.length === 0) return 0

  const sourceIds = new Set(source.map((e) => e.id))
  const target = await db
    .select({
      id: mealPlanEntries.id,
      date: mealPlanEntries.date,
      slotId: mealPlanEntries.slotId,
      sortOrder: mealPlanEntries.sortOrder,
    })
    .from(mealPlanEntries)
    .where(and(own, between(mealPlanEntries.date, input.toDate, targetTo)))

  // Pri nahradení zostanú len záznamy, ktoré sú zároveň zdrojom (prekrývajúce sa rozsahy).
  const kept = input.replace ? target.filter((t) => sourceIds.has(t.id)) : target
  const nextOrder = new Map<string, number>()
  for (const t of kept) {
    const key = `${t.date}|${t.slotId}`
    nextOrder.set(key, Math.max(nextOrder.get(key) ?? 0, t.sortOrder + 1))
  }

  const statements: BatchItem<'sqlite'>[] = []
  if (input.replace) {
    // Mazanie podľa konkrétnych id po kúskoch – D1 dovolí max 100 viazaných parametrov na príkaz.
    const toDelete = target.filter((t) => !sourceIds.has(t.id)).map((t) => t.id)
    for (const ids of chunk(toDelete, 90)) {
      statements.push(db.delete(mealPlanEntries).where(and(own, inArray(mealPlanEntries.id, ids))))
    }
  }
  for (const e of source) {
    const date = addDays(e.date, offset)
    const key = `${date}|${e.slotId}`
    const sortOrder = nextOrder.get(key) ?? 0
    nextOrder.set(key, sortOrder + 1)
    statements.push(
      db.insert(mealPlanEntries).values({
        householdId,
        date,
        slotId: e.slotId,
        recipeId: e.recipeId,
        freeText: e.freeText,
        servingsOverride: e.servingsOverride,
        note: e.note,
        audience: e.audience,
        sortOrder,
      }),
    )
  }
  const [first, ...rest] = statements
  await db.batch([first!, ...rest])
  return source.length
}
