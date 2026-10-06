import { and, eq, inArray } from 'drizzle-orm'
import type { UserSettingsDto } from '../../shared/userSettings'
import type { UserSettingsUpdate } from '../../shared/schemas/userSettings'
import type { Db } from '../db/client'
import { userSettings } from '../db/schema'

export async function getUserSettings(db: Db, userId: string): Promise<UserSettingsDto> {
  const rows = await db
    .select({ key: userSettings.key, value: userSettings.value })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as UserSettingsDto
}

/** Uloží zmenené kľúče (hodnota `null` kľúč vymaže) a vráti všetky nastavenia používateľa. */
export async function updateUserSettings(
  db: Db,
  userId: string,
  patch: UserSettingsUpdate,
): Promise<UserSettingsDto> {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined)
  const toDelete = entries.filter(([, value]) => value === null).map(([key]) => key)
  const toSet = entries.filter(([, value]) => value !== null)

  if (toDelete.length > 0) {
    await db
      .delete(userSettings)
      .where(and(eq(userSettings.userId, userId), inArray(userSettings.key, toDelete)))
  }
  for (const [key, value] of toSet) {
    await db
      .insert(userSettings)
      .values({ userId, key, value })
      .onConflictDoUpdate({
        target: [userSettings.userId, userSettings.key],
        set: { value, updatedAt: new Date().toISOString() },
      })
  }
  return getUserSettings(db, userId)
}
