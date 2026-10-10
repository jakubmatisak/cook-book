import { and, eq } from 'drizzle-orm'
import { newId } from '../../shared/ids'
import type { Db } from '../db/client'
import {
  households,
  householdMembers,
  mealSlots,
  settings,
  shopCategories,
  shoppingLists,
  users,
} from '../db/schema'
import type { UserRow } from '../env'
import { addMembership, listMemberships } from './memberships'

/** Aplikácia má zatiaľ jednu domácnosť; pevné ID robí jej založenie idempotentným. */
export const DEFAULT_HOUSEHOLD_ID = 'default'

export const DEFAULT_SLOTS = [
  { name: 'Raňajky', defaultTime: '07:00' },
  { name: 'Desiata', defaultTime: '10:00' },
  { name: 'Obed', defaultTime: '12:00' },
  { name: 'Olovrant', defaultTime: '15:00' },
  { name: 'Večera', defaultTime: '18:00' },
] as const

export const DEFAULT_SHOP_CATEGORIES = [
  'Zelenina',
  'Ovocie',
  'Mäso a ryby',
  'Mliečne a vajcia',
  'Pečivo',
  'Pečenie',
  'Trvanlivé',
  'Konzervy a zaváraniny',
  'Koreniny a dochucovadlá',
  'Mrazené',
  'Nápoje',
  'Drogéria',
  'Iné',
] as const

/** `starterIngredientsAdded`: štartovací zoznam surovín sa už domácnosti raz pridal (klient to nastavuje len cez službu). */
export const DEFAULT_SETTINGS = {
  weekStartsOn: 1,
  childPortionFactor: 0.5,
  starterIngredientsAdded: false,
  /** Pri „Čo viem uvariť“ a návrhoch sa koreniny nepočítajú ako chýbajúce. */
  ignoreSpicesInPantry: false,
} as const

/**
 * Založí domácnosť s predvolenými slotmi, kategóriami, nákupným zoznamom a nastaveniami.
 * Bezpečné pri súbežnom volaní s rovnakým `id`: všetky inserty sú `on conflict do nothing` nad unikátnymi kľúčmi.
 */
export async function createHousehold(
  db: Db,
  name: string,
  id: string = newId(),
  ownerUserId?: string,
): Promise<string> {
  await db.batch([
    db.insert(households).values({ id, name }).onConflictDoNothing(),
    db
      .insert(mealSlots)
      .values(
        DEFAULT_SLOTS.map((s, i) => ({
          householdId: id,
          name: s.name,
          defaultTime: s.defaultTime,
          sortOrder: i,
        })),
      )
      .onConflictDoNothing(),
    db
      .insert(shopCategories)
      .values(DEFAULT_SHOP_CATEGORIES.map((name, i) => ({ householdId: id, name, sortOrder: i })))
      .onConflictDoNothing(),
    db
      .insert(shoppingLists)
      .values({ householdId: id, name: 'Nákup', isDefault: true })
      .onConflictDoNothing(),
    db
      .insert(settings)
      .values(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ householdId: id, key, value })))
      .onConflictDoNothing(),
    // Vlastník sa založí v tom istom kroku: domácnosť nikdy nezostane bez člena.
    ...(ownerUserId
      ? [
          db
            .insert(householdMembers)
            .values({ userId: ownerUserId, householdId: id, role: 'owner' })
            .onConflictDoNothing(),
        ]
      : []),
  ])
  return id
}

/**
 * Založí domácnosť človeku a urobí ho jej vlastníkom. Ak ešte nemá záznam používateľa (prvé prihlásenie cez
 * Cloudflare Access bez pozvania), založí ho tiež – s touto domácnosťou ako pôvodnou.
 */
export async function createOwnHousehold(
  db: Db,
  rawEmail: string,
  name: string,
): Promise<{ id: string; userId: string }> {
  const email = rawEmail.trim().toLowerCase()
  const existing = await findUserByEmail(db, email)
  if (existing) return { id: await createHousehold(db, name, undefined, existing.id), userId: existing.id }

  const id = await createHousehold(db, name)
  await db
    .insert(users)
    .values({ householdId: id, email, name: email.split('@')[0] || email })
    .onConflictDoNothing()
  const user = await findUserByEmail(db, email)
  if (!user) throw new Error(`Používateľa ${email} sa nepodarilo založiť.`)
  await addMembership(db, user.id, id, 'owner')
  return { id, userId: user.id }
}

/** Predvolená domácnosť, do ktorej sa pri prvom prihlásení zaradia e-maily zo zoznamu správcov (ALLOWED_EMAILS). */
export async function ensureHousehold(db: Db): Promise<string> {
  const id = DEFAULT_HOUSEHOLD_ID
  const existing = await db.select({ id: households.id }).from(households).where(eq(households.id, id)).get()
  if (existing) return existing.id
  return createHousehold(db, 'Naša domácnosť', id)
}

export const findUserByEmail = (db: Db, rawEmail: string) =>
  db.select().from(users).where(eq(users.email, rawEmail.trim().toLowerCase())).get()

/**
 * Používateľ zo zoznamu správcov: založí ho (ak treba) a bez členstva ho zaradí do predvolenej domácnosti.
 * Prvý človek v domácnosti je vlastník, ďalší členovia.
 */
export async function ensureUser(db: Db, rawEmail: string): Promise<UserRow> {
  const email = rawEmail.trim().toLowerCase()
  const householdId = await ensureHousehold(db)

  let user = await findUserByEmail(db, email)
  if (!user) {
    const name = email.split('@')[0] || email
    await db.insert(users).values({ householdId, email, name }).onConflictDoNothing()
    user = await findUserByEmail(db, email)
  }
  if (!user) throw new Error(`Používateľa ${email} sa nepodarilo založiť.`)

  if ((await listMemberships(db, user.id)).length === 0) {
    const owner = await db
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.role, 'owner')))
      .get()
    await addMembership(db, user.id, householdId, owner ? 'member' : 'owner')
  }
  return user
}
