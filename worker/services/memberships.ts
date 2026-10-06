import { and, asc, eq } from 'drizzle-orm'
import type { HouseholdRole } from '../../shared/family'
import type { Db } from '../db/client'
import { households, householdMembers, users } from '../db/schema'
import type { UserRow } from '../env'
import { HttpError } from '../errors'

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
