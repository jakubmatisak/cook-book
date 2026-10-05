import { and, asc, between, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { TemplateApplyResult, WeekTemplateDto } from '../../shared/api'
import { addDays, daysBetween } from '../../shared/dates'
import { newId } from '../../shared/ids'
import type { TemplateApplyInput, TemplateCreateInput } from '../../shared/schemas/plan'
import type { Db } from '../db/client'
import { mealPlanEntries, recipes, weekTemplateEntries, weekTemplates } from '../db/schema'
import { HttpError } from '../errors'
import { chunk } from '../http'

const notFound = () => new HttpError(404, 'not_found', 'Šablóna neexistuje.')
const DAYS = 7

const entryCountSql = sql<number>`(select count(*) from week_template_entries e where e.template_id = "week_templates"."id")`

export async function listTemplates(db: Db, householdId: string): Promise<WeekTemplateDto[]> {
  return db
    .select({ id: weekTemplates.id, name: weekTemplates.name, entryCount: entryCountSql })
    .from(weekTemplates)
    .where(eq(weekTemplates.householdId, householdId))
    .orderBy(asc(weekTemplates.name))
}

async function findTemplate(db: Db, householdId: string, id: string) {
  const template = await db
    .select()
    .from(weekTemplates)
    .where(and(eq(weekTemplates.id, id), eq(weekTemplates.householdId, householdId)))
    .get()
  if (!template) throw notFound()
  return template
}

/** Uloží jedlá 7 dní od `fromDate` ako šablónu; dni sa zapamätajú ako poradie od začiatku týždňa. */
export async function saveTemplate(
  db: Db,
  householdId: string,
  input: TemplateCreateInput,
): Promise<WeekTemplateDto> {
  const rows = await db
    .select({
      date: mealPlanEntries.date,
      slotId: mealPlanEntries.slotId,
      recipeId: mealPlanEntries.recipeId,
      freeText: mealPlanEntries.freeText,
      sortOrder: mealPlanEntries.sortOrder,
      recipeDeletedAt: recipes.deletedAt,
    })
    .from(mealPlanEntries)
    .leftJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
    .where(
      and(
        eq(mealPlanEntries.householdId, householdId),
        between(mealPlanEntries.date, input.fromDate, addDays(input.fromDate, DAYS - 1)),
      ),
    )
    .orderBy(asc(mealPlanEntries.date), asc(mealPlanEntries.sortOrder), asc(mealPlanEntries.createdAt))
  // Zmazaný recept do šablóny nepatrí; voľný text áno.
  const usable = rows.filter((r) => (r.recipeId ? r.recipeDeletedAt === null : r.freeText !== null))
  if (usable.length === 0) {
    throw new HttpError(400, 'empty_week', 'Tento týždeň je prázdny, nie je čo uložiť.')
  }

  const templateId = newId()
  const statements: BatchItem<'sqlite'>[] = [
    db.insert(weekTemplates).values({ id: templateId, householdId, name: input.name }),
  ]
  // 7 stĺpcov na riadok a limit D1 100 parametrov na príkaz.
  for (const part of chunk(usable, 12)) {
    statements.push(
      db.insert(weekTemplateEntries).values(
        part.map((r) => ({
          id: newId(),
          templateId,
          weekday: daysBetween(input.fromDate, r.date),
          slotId: r.slotId,
          recipeId: r.recipeId,
          freeText: r.recipeId ? null : r.freeText,
          sortOrder: r.sortOrder,
        })),
      ),
    )
  }
  const [first, ...rest] = statements
  await db.batch([first!, ...rest])
  return { id: templateId, name: input.name, entryCount: usable.length }
}

/** Vloží šablónu od `toDate`; `replace` najprv vyprázdni cieľový týždeň. Zmazané recepty sa preskočia. */
export async function applyTemplate(
  db: Db,
  householdId: string,
  id: string,
  input: TemplateApplyInput,
): Promise<TemplateApplyResult> {
  await findTemplate(db, householdId, id)
  const entries = await db
    .select({
      weekday: weekTemplateEntries.weekday,
      slotId: weekTemplateEntries.slotId,
      recipeId: weekTemplateEntries.recipeId,
      freeText: weekTemplateEntries.freeText,
      recipeDeletedAt: recipes.deletedAt,
      recipeLive: sql<number>`case when ${recipes.id} is null then 0 else 1 end`,
    })
    .from(weekTemplateEntries)
    .leftJoin(recipes, and(eq(recipes.id, weekTemplateEntries.recipeId), isNull(recipes.deletedAt)))
    .where(eq(weekTemplateEntries.templateId, id))
    .orderBy(asc(weekTemplateEntries.weekday), asc(weekTemplateEntries.sortOrder))

  // Recept zmazaný (aj natrvalo) alebo prázdny riadok sa neprenesie.
  const usable = entries.filter((e) => (e.recipeId ? e.recipeLive === 1 : e.freeText !== null))
  const skipped = entries.length - usable.length

  const own = eq(mealPlanEntries.householdId, householdId)
  const targetTo = addDays(input.toDate, DAYS - 1)
  const existing = await db
    .select({
      id: mealPlanEntries.id,
      date: mealPlanEntries.date,
      slotId: mealPlanEntries.slotId,
      sortOrder: mealPlanEntries.sortOrder,
    })
    .from(mealPlanEntries)
    .where(and(own, between(mealPlanEntries.date, input.toDate, targetTo)))

  const nextOrder = new Map<string, number>()
  if (!input.replace) {
    for (const e of existing) {
      const key = `${e.date}|${e.slotId}`
      nextOrder.set(key, Math.max(nextOrder.get(key) ?? 0, e.sortOrder + 1))
    }
  }

  const statements: BatchItem<'sqlite'>[] = []
  if (input.replace) {
    for (const ids of chunk(
      existing.map((e) => e.id),
      90,
    )) {
      statements.push(db.delete(mealPlanEntries).where(and(own, inArray(mealPlanEntries.id, ids))))
    }
  }
  for (const e of usable) {
    const date = addDays(input.toDate, e.weekday)
    const key = `${date}|${e.slotId}`
    const sortOrder = nextOrder.get(key) ?? 0
    nextOrder.set(key, sortOrder + 1)
    statements.push(
      db.insert(mealPlanEntries).values({
        householdId,
        date,
        slotId: e.slotId,
        recipeId: e.recipeId,
        freeText: e.recipeId ? null : e.freeText,
        sortOrder,
      }),
    )
  }
  if (statements.length > 0) {
    const [first, ...rest] = statements
    await db.batch([first!, ...rest])
  }
  return { applied: usable.length, skipped }
}

export async function deleteTemplate(db: Db, householdId: string, id: string): Promise<void> {
  await findTemplate(db, householdId, id)
  await db.delete(weekTemplates).where(eq(weekTemplates.id, id))
}
