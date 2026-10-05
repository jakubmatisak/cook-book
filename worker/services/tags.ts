import { and, asc, eq, ne, sql } from 'drizzle-orm'
import type { TagDto } from '../../shared/api'
import type { TagInput } from '../../shared/schemas/recipe'
import { normalizeText } from '../../shared/text'
import type { Db } from '../db/client'
import { tags } from '../db/schema'
import { HttpError } from '../errors'

const recipeCount = sql<number>`(
  select count(*) from recipe_tags rt
  join recipes r on r.id = rt.recipe_id
  where rt.tag_id = "tags"."id" and r.deleted_at is null
)`.mapWith(Number)

export async function listTags(db: Db, householdId: string): Promise<TagDto[]> {
  const rows = await db
    .select({ id: tags.id, name: tags.name, color: tags.color, recipeCount })
    .from(tags)
    .where(eq(tags.householdId, householdId))
    .orderBy(asc(tags.name))
  return rows
}

async function findTag(db: Db, householdId: string, id: string) {
  const row = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.householdId, householdId)))
    .get()
  if (!row) throw new HttpError(404, 'not_found', 'Tag neexistuje.')
  return row
}

/** Názov sa porovnáva bez diakritiky a veľkosti písmen („Detské“ = „detske“). */
async function assertUniqueName(db: Db, householdId: string, name: string, exceptId?: string) {
  const rows = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(and(eq(tags.householdId, householdId), exceptId ? ne(tags.id, exceptId) : undefined))
  const wanted = normalizeText(name)
  const clash = rows.find((t) => normalizeText(t.name) === wanted)
  if (clash) throw new HttpError(409, 'duplicate', `Tag „${clash.name}“ už existuje.`)
}

const toDto = (row: typeof tags.$inferSelect, count: number): TagDto => ({
  id: row.id,
  name: row.name,
  color: row.color,
  recipeCount: count,
})

export async function createTag(db: Db, householdId: string, input: TagInput): Promise<TagDto> {
  await assertUniqueName(db, householdId, input.name)
  const [row] = await db
    .insert(tags)
    .values({ householdId, name: input.name, color: input.color })
    .returning()
  return toDto(row!, 0)
}

export async function updateTag(db: Db, householdId: string, id: string, input: TagInput): Promise<TagDto> {
  await findTag(db, householdId, id)
  await assertUniqueName(db, householdId, input.name, id)
  await db.update(tags).set({ name: input.name, color: input.color }).where(eq(tags.id, id))
  const updated = (await listTags(db, householdId)).find((t) => t.id === id)
  if (!updated) throw new HttpError(404, 'not_found', 'Tag neexistuje.')
  return updated
}

/** Zmaže tag; väzby na recepty zmiznú (cascade), recepty ostanú. */
export async function deleteTag(db: Db, householdId: string, id: string): Promise<void> {
  await findTag(db, householdId, id)
  await db.delete(tags).where(eq(tags.id, id))
}
