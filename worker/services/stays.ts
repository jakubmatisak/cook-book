import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import type { GuestStayDto } from '../../shared/api'
import type { GuestStayInput } from '../../shared/schemas/plan'
import type { Db } from '../db/client'
import { familyMembers, guestStays } from '../db/schema'
import { HttpError } from '../errors'

const toDto = (row: typeof guestStays.$inferSelect): GuestStayDto => ({
  id: row.id,
  memberId: row.memberId,
  fromDate: row.fromDate,
  toDate: row.toDate,
})

/** Pobyty, ktoré sa aspoň jedným dňom prekrývajú s rozsahom od – do (vrátane). */
export async function listStays(
  db: Db,
  householdId: string,
  from: string,
  to: string,
): Promise<GuestStayDto[]> {
  const rows = await db
    .select()
    .from(guestStays)
    .where(
      and(
        eq(guestStays.householdId, householdId),
        lte(guestStays.fromDate, to),
        gte(guestStays.toDate, from),
      ),
    )
    .orderBy(asc(guestStays.fromDate), asc(guestStays.createdAt))
  return rows.map(toDto)
}

/** Návštevy prítomné v daný deň podľa pobytov. */
export const stayGuestsOn = (stays: readonly GuestStayDto[], date: string): string[] => [
  ...new Set(stays.filter((s) => s.fromDate <= date && date <= s.toDate).map((s) => s.memberId)),
]

/** Založí pobyt pre každého zvoleného člena návštevy (všetci musia byť návštevy z tejto domácnosti). */
export async function createStays(
  db: Db,
  householdId: string,
  input: GuestStayInput,
): Promise<GuestStayDto[]> {
  const guests = await db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.householdId, householdId),
        eq(familyMembers.kind, 'guest'),
        inArray(familyMembers.id, input.memberIds),
      ),
    )
  if (guests.length !== input.memberIds.length) {
    throw new HttpError(400, 'invalid_guest', 'Vybraná návšteva neexistuje.')
  }
  const rows = await db
    .insert(guestStays)
    .values(
      input.memberIds.map((memberId) => ({
        householdId,
        memberId,
        fromDate: input.fromDate,
        toDate: input.toDate,
      })),
    )
    .returning()
  return rows.map(toDto)
}

export async function deleteStay(db: Db, householdId: string, id: string): Promise<void> {
  const removed = await db
    .delete(guestStays)
    .where(and(eq(guestStays.id, id), eq(guestStays.householdId, householdId)))
    .returning({ id: guestStays.id })
  if (removed.length === 0) throw new HttpError(404, 'not_found', 'Pobyt návštevy neexistuje.')
}
