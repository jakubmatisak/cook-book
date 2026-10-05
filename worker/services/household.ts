import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { households, mealSlots, settings, shopCategories, shoppingLists, users } from '../db/schema'
import type { UserRow } from '../env'

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
  'Trvanlivé',
  'Koreniny a dochucovadlá',
  'Mrazené',
  'Nápoje',
  'Drogéria',
  'Iné',
] as const

export const DEFAULT_SETTINGS = { weekStartsOn: 1, childPortionFactor: 0.5 } as const

/**
 * Zabezpečí existenciu domácnosti s predvolenými slotmi, kategóriami, zoznamom a nastaveniami.
 * Bezpečné pri súbežnom volaní: všetky inserty sú `on conflict do nothing` nad unikátnymi kľúčmi.
 */
export async function ensureHousehold(db: Db): Promise<string> {
  const id = DEFAULT_HOUSEHOLD_ID
  const existing = await db.select({ id: households.id }).from(households).where(eq(households.id, id)).get()
  if (existing) return existing.id

  await db.batch([
    db.insert(households).values({ id, name: 'Naša domácnosť' }).onConflictDoNothing(),
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
  ])
  return id
}

const findUser = (db: Db, email: string) => db.select().from(users).where(eq(users.email, email)).get()

/** Vráti používateľa podľa e-mailu; pri prvom prihlásení ho založí v domácnosti. */
export async function ensureUser(db: Db, rawEmail: string): Promise<UserRow> {
  const email = rawEmail.trim().toLowerCase()
  const found = await findUser(db, email)
  if (found) return found

  const householdId = await ensureHousehold(db)
  const name = email.split('@')[0] || email
  await db.insert(users).values({ householdId, email, name }).onConflictDoNothing()

  const created = await findUser(db, email)
  if (!created) throw new Error(`Používateľa ${email} sa nepodarilo založiť.`)
  return created
}
