import { and, asc, eq } from 'drizzle-orm'
import type { StapleDto } from '../../shared/api'
import type { StapleCreateInput, StapleUpdateInput } from '../../shared/schemas/pantry'
import { normalizeText } from '../../shared/text'
import type { Db } from '../db/client'
import { ingredients, stapleItems } from '../db/schema'
import { HttpError } from '../errors'
import { resolveIngredients } from './catalog'

type StapleRow = typeof stapleItems.$inferSelect

const notFound = () => new HttpError(404, 'not_found', 'Stála položka neexistuje.')

const toDto = (row: StapleRow, name: string): StapleDto => ({
  id: row.id,
  ingredientId: row.ingredientId,
  name,
  quantity: row.quantity,
  unit: row.unit,
  everyNWeeks: row.everyNWeeks,
})

export async function listStaples(db: Db, householdId: string): Promise<StapleDto[]> {
  const rows = await db
    .select({ row: stapleItems, name: ingredients.name })
    .from(stapleItems)
    .innerJoin(ingredients, eq(ingredients.id, stapleItems.ingredientId))
    .where(eq(stapleItems.householdId, householdId))
    .orderBy(asc(ingredients.nameNormalized))
  return rows.map(({ row, name }) => toDto(row, name))
}

async function findStaple(db: Db, householdId: string, id: string) {
  const found = await db
    .select({ row: stapleItems, name: ingredients.name })
    .from(stapleItems)
    .innerJoin(ingredients, eq(ingredients.id, stapleItems.ingredientId))
    .where(and(eq(stapleItems.id, id), eq(stapleItems.householdId, householdId)))
    .get()
  if (!found) throw notFound()
  return found
}

/** Ingrediencia sa nájde podľa názvu (bez diakritiky a veľkosti písmen), inak sa založí. */
export async function createStaple(
  db: Db,
  householdId: string,
  input: StapleCreateInput,
): Promise<StapleDto> {
  const resolved = await resolveIngredients(db, householdId, [{ name: input.name, unit: input.unit }])
  const ingredientId = resolved.get(normalizeText(input.name))
  if (!ingredientId) throw new HttpError(500, 'internal_error', 'Ingredienciu sa nepodarilo založiť.')
  const [row] = await db
    .insert(stapleItems)
    .values({
      householdId,
      ingredientId,
      quantity: input.quantity,
      unit: input.unit,
      everyNWeeks: input.everyNWeeks,
    })
    .returning()
  const { name } = await findStaple(db, householdId, row!.id)
  return toDto(row!, name)
}

export async function updateStaple(
  db: Db,
  householdId: string,
  id: string,
  patch: StapleUpdateInput,
): Promise<StapleDto> {
  const current = await findStaple(db, householdId, id)
  const set: Partial<StapleRow> = {}
  if (patch.quantity !== undefined) set.quantity = patch.quantity
  if (patch.unit !== undefined) set.unit = patch.unit
  if (patch.everyNWeeks !== undefined) set.everyNWeeks = patch.everyNWeeks
  // Bez množstva jednotka nemá zmysel.
  if (set.quantity === null) set.unit = null
  if (Object.keys(set).length === 0) return toDto(current.row, current.name)
  const [row] = await db.update(stapleItems).set(set).where(eq(stapleItems.id, id)).returning()
  return toDto(row!, current.name)
}

export async function deleteStaple(db: Db, householdId: string, id: string): Promise<void> {
  await findStaple(db, householdId, id)
  await db.delete(stapleItems).where(eq(stapleItems.id, id))
}
