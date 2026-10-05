import { and, asc, eq, sql } from 'drizzle-orm'
import type { FamilyMemberDto, HouseholdSettings, MealSlotDto } from '../../shared/api'
import type { MemberInput, SettingsUpdate, SlotUpdate } from '../../shared/schemas/family'
import type { Db } from '../db/client'
import { familyMembers, mealSlots, settings } from '../db/schema'
import { HttpError, isUniqueViolation } from '../errors'
import { DEFAULT_SETTINGS } from './household'

type MemberRow = typeof familyMembers.$inferSelect
type SlotRow = typeof mealSlots.$inferSelect

export const toMemberDto = (m: MemberRow): FamilyMemberDto => ({
  id: m.id,
  name: m.name,
  kind: m.kind,
  birthDate: m.birthDate,
  portionFactor: m.portionFactor,
  color: m.color,
  isActive: m.isActive,
  sortOrder: m.sortOrder,
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
  const rows = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.householdId, householdId))
    .orderBy(asc(familyMembers.sortOrder), asc(familyMembers.name))
  return rows.map(toMemberDto)
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
  return toMemberDto(row!)
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
