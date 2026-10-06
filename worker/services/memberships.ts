import { and, asc, eq, sql } from 'drizzle-orm'
import type { HouseholdMemberDto } from '../../shared/api'
import type { HouseholdRole } from '../../shared/family'
import type { Db } from '../db/client'
import { households, householdMembers, users } from '../db/schema'
import type { UserRow } from '../env'
import { HttpError } from '../errors'
import { isAllowedEmail } from './accessList'

/** Členstvo používateľa v domácnosti (aj s názvom domácnosti, aby sa dal zostaviť prepínač). */
export interface Membership {
  householdId: string
  name: string
  role: HouseholdRole
  lastLoginAt: string | null
}

/** Najčastejšie raz za hodinu sa zapíše posledné prihlásenie (šetrí zápisy na free pláne). */
const LOGIN_TOUCH_MS = 60 * 60 * 1000

export async function listMemberships(db: Db, userId: string): Promise<Membership[]> {
  return db
    .select({
      householdId: householdMembers.householdId,
      name: households.name,
      role: householdMembers.role,
      lastLoginAt: householdMembers.lastLoginAt,
    })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, userId))
    .orderBy(asc(householdMembers.createdAt), asc(households.name))
}

export async function addMembership(
  db: Db,
  userId: string,
  householdId: string,
  role: HouseholdRole,
): Promise<void> {
  await db.insert(householdMembers).values({ userId, householdId, role }).onConflictDoNothing()
}

/** Zapíše posledné prihlásenie, ak je zápis starší ako hodina (alebo chýba). */
export async function touchLogin(db: Db, userId: string, membership: Membership, now = new Date()) {
  const last = membership.lastLoginAt ? Date.parse(membership.lastLoginAt) : 0
  if (now.getTime() - last < LOGIN_TOUCH_MS) return
  await db
    .update(householdMembers)
    .set({ lastLoginAt: now.toISOString() })
    .where(and(eq(householdMembers.userId, userId), eq(householdMembers.householdId, membership.householdId)))
}

/**
 * Pozve e-mail do domácnosti: založí používateľa (ak ešte neexistuje) a jeho členstvo.
 * Už existujúce členstvo je 409.
 */
export async function inviteMember(
  db: Db,
  householdId: string,
  rawEmail: string,
  role: HouseholdRole,
): Promise<UserRow> {
  const email = rawEmail.trim().toLowerCase()
  let user = await db.select().from(users).where(eq(users.email, email)).get()
  if (!user) {
    const name = email.split('@')[0] || email
    await db.insert(users).values({ householdId, email, name }).onConflictDoNothing()
    user = await db.select().from(users).where(eq(users.email, email)).get()
  }
  if (!user) throw new Error(`Používateľa ${email} sa nepodarilo založiť.`)

  const existing = await db
    .select({ userId: householdMembers.userId })
    .from(householdMembers)
    .where(and(eq(householdMembers.userId, user.id), eq(householdMembers.householdId, householdId)))
    .get()
  if (existing) throw new HttpError(409, 'already_member', 'Tento e-mail už je členom domácnosti.')

  await addMembership(db, user.id, householdId, role)
  return user
}

const toMemberDto = (
  row: { userId: string; email: string; name: string; role: HouseholdRole; lastLoginAt: string | null },
  adminEmails: string | undefined,
): HouseholdMemberDto => ({ ...row, locked: isAllowedEmail(row.email, adminEmails) })

const memberRows = (db: Db) =>
  db
    .select({
      userId: householdMembers.userId,
      email: users.email,
      name: users.name,
      role: householdMembers.role,
      lastLoginAt: householdMembers.lastLoginAt,
    })
    .from(householdMembers)
    .innerJoin(users, eq(users.id, householdMembers.userId))

/** Členovia domácnosti; vlastníci prví, potom podľa e-mailu. */
export async function listHouseholdMembers(
  db: Db,
  householdId: string,
  adminEmails: string | undefined,
): Promise<HouseholdMemberDto[]> {
  const rows = await memberRows(db)
    .where(eq(householdMembers.householdId, householdId))
    .orderBy(sql`${householdMembers.role} = 'owner' desc`, asc(users.email))
  return rows.map((r) => toMemberDto(r, adminEmails))
}

async function loadMember(db: Db, householdId: string, userId: string, adminEmails: string | undefined) {
  const row = await memberRows(db)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
    .get()
  if (!row) throw new HttpError(404, 'not_found', 'Člen domácnosti neexistuje.')
  return toMemberDto(row, adminEmails)
}

const ownerCount = async (db: Db, householdId: string): Promise<number> =>
  (
    await db
      .select({ n: sql<number>`count(*)` })
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.role, 'owner')))
      .get()
  )?.n ?? 0

const lastOwner = () => new HttpError(409, 'last_owner', 'Domácnosť musí mať aspoň jedného vlastníka.')

/** Pozve e-mail a vráti jeho členstvo v domácnosti. */
export async function inviteHouseholdMember(
  db: Db,
  householdId: string,
  email: string,
  role: HouseholdRole,
  adminEmails: string | undefined,
): Promise<HouseholdMemberDto> {
  const user = await inviteMember(db, householdId, email, role)
  return loadMember(db, householdId, user.id, adminEmails)
}

export async function changeMemberRole(
  db: Db,
  householdId: string,
  userId: string,
  role: HouseholdRole,
  adminEmails: string | undefined,
): Promise<HouseholdMemberDto> {
  const current = await loadMember(db, householdId, userId, adminEmails)
  if (current.role === 'owner' && role !== 'owner' && (await ownerCount(db, householdId)) <= 1) {
    throw lastOwner()
  }
  await db
    .update(householdMembers)
    .set({ role })
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
  return { ...current, role }
}

/** Odoberie členstvo (účet ostáva, aby sa dal znova pozvať). */
export async function removeMember(
  db: Db,
  householdId: string,
  userId: string,
  adminEmails: string | undefined,
): Promise<void> {
  const current = await loadMember(db, householdId, userId, adminEmails)
  if (current.locked) {
    throw new HttpError(409, 'locked', 'Tento e-mail je nastavený pri nasadení a v aplikácii sa neodoberie.')
  }
  if (current.role === 'owner' && (await ownerCount(db, householdId)) <= 1) throw lastOwner()
  await db
    .delete(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
}

/** Premenuje domácnosť. */
export async function renameHousehold(db: Db, householdId: string, name: string): Promise<void> {
  await db.update(households).set({ name }).where(eq(households.id, householdId))
}
