import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { FamilyMemberDto, HouseholdSettings, MealSlotDto } from '../../shared/api'
import { newId } from '../../shared/ids'
import { PREFERENCE_KINDS, type MemberPreference, type PreferenceKind } from '../../shared/preferences'
import type {
  MemberInput,
  MemberPreferencesInput,
  SettingsUpdate,
  SlotUpdate,
} from '../../shared/schemas/family'
import { normalizeText } from '../../shared/text'
import type { Db } from '../db/client'
import { familyMembers, ingredients, mealSlots, memberPreferences, settings, tags } from '../db/schema'
import { HttpError, isUniqueViolation } from '../errors'
import { chunk } from '../http'
import { DEFAULT_SETTINGS } from './household'

type MemberRow = typeof familyMembers.$inferSelect
type SlotRow = typeof mealSlots.$inferSelect

/** Preferencie domácnosti s názvami ingrediencií a tagov (jeden dotaz; hodí sa aj do `db.batch`). */
export const preferenceRowsQuery = (db: Db, householdId: string) =>
  db
    .select({
      memberId: memberPreferences.memberId,
      kind: memberPreferences.kind,
      ingredientId: memberPreferences.ingredientId,
      tagId: memberPreferences.tagId,
      // Aliasy: v `db.batch` D1 vracia riadky podľa názvu stĺpca a dva stĺpce `name` by sa prepísali.
      ingredientName: sql<string | null>`${ingredients.name}`.as('ingredient_name'),
      tagName: sql<string | null>`${tags.name}`.as('tag_name'),
    })
    .from(memberPreferences)
    .innerJoin(familyMembers, eq(familyMembers.id, memberPreferences.memberId))
    .leftJoin(ingredients, eq(ingredients.id, memberPreferences.ingredientId))
    .leftJoin(tags, eq(tags.id, memberPreferences.tagId))
    .where(eq(familyMembers.householdId, householdId))

const KIND_ORDER = new Map<PreferenceKind, number>(PREFERENCE_KINDS.map((k, i) => [k, i]))

/** Preferencie po členoch: alergie, averzie, diéty, v rámci druhu podľa názvu. Zmazaná ingrediencia/tag sa vynechá. */
export function groupPreferences(
  rows: Awaited<ReturnType<typeof preferenceRowsQuery>>,
): Map<string, MemberPreference[]> {
  const byMember = new Map<string, MemberPreference[]>()
  for (const r of rows) {
    const label = r.ingredientName ?? r.tagName
    if (!label) continue
    const list = byMember.get(r.memberId) ?? []
    list.push({ kind: r.kind, ingredientId: r.ingredientId, tagId: r.tagId, label })
    byMember.set(r.memberId, list)
  }
  for (const list of byMember.values()) {
    list.sort(
      (a, b) =>
        (KIND_ORDER.get(a.kind) ?? 9) - (KIND_ORDER.get(b.kind) ?? 9) ||
        normalizeText(a.label).localeCompare(normalizeText(b.label)),
    )
  }
  return byMember
}

export const toMemberDto = (m: MemberRow, preferences: MemberPreference[] = []): FamilyMemberDto => ({
  id: m.id,
  name: m.name,
  kind: m.kind,
  birthDate: m.birthDate,
  portionFactor: m.portionFactor,
  color: m.color,
  isActive: m.isActive,
  sortOrder: m.sortOrder,
  preferences,
})

export const toSlotDto = (s: SlotRow): MealSlotDto => ({
  id: s.id,
  name: s.name,
  sortOrder: s.sortOrder,
  isEnabled: s.isEnabled,
  defaultTime: s.defaultTime,
})

/** Nastavenia domácnosti zlúčené s predvolenými (chýbajúci kľúč = predvolená hodnota). */
export function mergeSettings(rows: readonly { key: string; value: unknown }[]): HouseholdSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(rows.map((r) => [r.key, r.value])),
  } as HouseholdSettings
}

export async function getSettings(db: Db, householdId: string): Promise<HouseholdSettings> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(eq(settings.householdId, householdId))
  return mergeSettings(rows)
}

export async function updateSettings(db: Db, householdId: string, patch: SettingsUpdate) {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined)
  if (entries.length) {
    const [first, ...rest] = entries.map(([key, value]) =>
      db
        .insert(settings)
        .values({ householdId, key, value })
        .onConflictDoUpdate({ target: [settings.householdId, settings.key], set: { value } }),
    )
    await db.batch([first!, ...rest])
  }
  return getSettings(db, householdId)
}

export async function listMembers(db: Db, householdId: string): Promise<FamilyMemberDto[]> {
  const [rows, prefRows] = await db.batch([
    db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.householdId, householdId))
      .orderBy(asc(familyMembers.sortOrder), asc(familyMembers.name)),
    preferenceRowsQuery(db, householdId),
  ])
  const prefs = groupPreferences(prefRows)
  return rows.map((m) => toMemberDto(m, prefs.get(m.id)))
}

async function findMember(db: Db, householdId: string, id: string): Promise<MemberRow> {
  const row = await db
    .select()
    .from(familyMembers)
    .where(and(eq(familyMembers.id, id), eq(familyMembers.householdId, householdId)))
    .get()
  if (!row) throw new HttpError(404, 'not_found', 'Člen rodiny neexistuje.')
  return row
}

async function defaultFactor(db: Db, householdId: string, kind: MemberInput['kind']): Promise<number> {
  if (kind === 'adult') return 1
  return (await getSettings(db, householdId)).childPortionFactor
}

export async function createMember(
  db: Db,
  householdId: string,
  input: MemberInput,
): Promise<FamilyMemberDto> {
  const next = await db
    .select({ max: sql<number>`coalesce(max(${familyMembers.sortOrder}), -1)` })
    .from(familyMembers)
    .where(eq(familyMembers.householdId, householdId))
    .get()
  const [row] = await db
    .insert(familyMembers)
    .values({
      householdId,
      name: input.name,
      kind: input.kind,
      portionFactor: input.portionFactor ?? (await defaultFactor(db, householdId, input.kind)),
      birthDate: input.birthDate,
      color: input.color,
      isActive: input.isActive,
      sortOrder: input.sortOrder ?? (next?.max ?? -1) + 1,
    })
    .returning()
  return toMemberDto(row!)
}

export async function updateMember(
  db: Db,
  householdId: string,
  id: string,
  input: MemberInput,
): Promise<FamilyMemberDto> {
  const current = await findMember(db, householdId, id)
  const [row] = await db
    .update(familyMembers)
    .set({
      name: input.name,
      kind: input.kind,
      portionFactor:
        input.portionFactor ??
        (input.kind === current.kind
          ? current.portionFactor
          : await defaultFactor(db, householdId, input.kind)),
      birthDate: input.birthDate,
      color: input.color,
      isActive: input.isActive,
      sortOrder: input.sortOrder ?? current.sortOrder,
    })
    .where(eq(familyMembers.id, id))
    .returning()
  const prefs = groupPreferences(await preferenceRowsQuery(db, householdId))
  return toMemberDto(row!, prefs.get(id))
}

export async function deleteMember(db: Db, householdId: string, id: string): Promise<void> {
  await findMember(db, householdId, id)
  await db.delete(familyMembers).where(eq(familyMembers.id, id))
}

export async function updateSlot(
  db: Db,
  householdId: string,
  id: string,
  patch: SlotUpdate,
): Promise<MealSlotDto> {
  const where = and(eq(mealSlots.id, id), eq(mealSlots.householdId, householdId))
  const current = await db.select().from(mealSlots).where(where).get()
  if (!current) throw new HttpError(404, 'not_found', 'Jedlo dňa neexistuje.')
  if (Object.keys(patch).length === 0) return toSlotDto(current)
  try {
    const [row] = await db.update(mealSlots).set(patch).where(where).returning()
    return toSlotDto(row!)
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, 'duplicate', 'Jedlo s týmto názvom už existuje.')
    throw error
  }
}

const invalidPreference = () => new HttpError(400, 'invalid_preference', 'Ingrediencia alebo tag neexistuje.')

/** Všetky zadané id musia existovať v domácnosti, inak sa neuloží nič. */
async function assertAll(
  db: Db,
  householdId: string,
  table: 'ingredients' | 'tags',
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return
  let found = 0
  for (const part of chunk(ids, 90)) {
    const rows =
      table === 'ingredients'
        ? await db
            .select({ id: ingredients.id })
            .from(ingredients)
            .where(
              and(
                eq(ingredients.householdId, householdId),
                isNull(ingredients.deletedAt),
                inArray(ingredients.id, part),
              ),
            )
        : await db
            .select({ id: tags.id })
            .from(tags)
            .where(and(eq(tags.householdId, householdId), inArray(tags.id, part)))
    found += rows.length
  }
  if (found !== ids.length) throw invalidPreference()
}

/**
 * Nahradí všetky preferencie člena. Duplicity sa spoja a alergia má prednosť pred averziou
 * na tú istú ingredienciu.
 */
export async function saveMemberPreferences(
  db: Db,
  householdId: string,
  memberId: string,
  input: MemberPreferencesInput,
): Promise<FamilyMemberDto> {
  const member = await findMember(db, householdId, memberId)
  const allergies = [...new Set(input.allergies)]
  const dislikes = [...new Set(input.dislikes)].filter((id) => !allergies.includes(id))
  const diets = [...new Set(input.diets)]
  await assertAll(db, householdId, 'ingredients', [...allergies, ...dislikes])
  await assertAll(db, householdId, 'tags', diets)

  const rows = [
    ...allergies.map((id) => ({ kind: 'allergy' as const, ingredientId: id, tagId: null })),
    ...dislikes.map((id) => ({ kind: 'dislike' as const, ingredientId: id, tagId: null })),
    ...diets.map((id) => ({ kind: 'diet' as const, ingredientId: null, tagId: id })),
  ]
  const statements: BatchItem<'sqlite'>[] = [
    db.delete(memberPreferences).where(eq(memberPreferences.memberId, memberId)),
  ]
  // 5 stĺpcov na riadok a limit D1 100 parametrov na príkaz.
  for (const part of chunk(rows, 15)) {
    statements.push(db.insert(memberPreferences).values(part.map((r) => ({ id: newId(), memberId, ...r }))))
  }
  const [first, ...rest] = statements
  await db.batch([first!, ...rest])
  const prefs = groupPreferences(await preferenceRowsQuery(db, householdId))
  return toMemberDto(member, prefs.get(memberId))
}
