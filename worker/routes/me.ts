import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { HouseholdSettings, MeResponse } from '../../shared/api'
import { familyMembers, households, mealSlots, settings } from '../db/schema'
import type { AppEnv } from '../env'
import { HttpError } from '../errors'

export const meRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const hid = user.householdId

  const [householdRows, memberRows, slotRows, settingRows] = await db.batch([
    db.select().from(households).where(eq(households.id, hid)),
    db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.householdId, hid))
      .orderBy(asc(familyMembers.sortOrder), asc(familyMembers.name)),
    db.select().from(mealSlots).where(eq(mealSlots.householdId, hid)).orderBy(asc(mealSlots.sortOrder)),
    db.select().from(settings).where(eq(settings.householdId, hid)),
  ])

  const household = householdRows[0]
  if (!household) throw new HttpError(500, 'household_missing', 'Domácnosť používateľa neexistuje.')

  const body: MeResponse = {
    user: { id: user.id, email: user.email, name: user.name, memberId: user.memberId },
    household: { id: household.id, name: household.name },
    members: memberRows.map((m) => ({
      id: m.id,
      name: m.name,
      kind: m.kind,
      birthDate: m.birthDate,
      portionFactor: m.portionFactor,
      color: m.color,
      isActive: m.isActive,
      sortOrder: m.sortOrder,
    })),
    slots: slotRows.map((s) => ({
      id: s.id,
      name: s.name,
      sortOrder: s.sortOrder,
      isEnabled: s.isEnabled,
      defaultTime: s.defaultTime,
    })),
    settings: Object.fromEntries(settingRows.map((s) => [s.key, s.value])) as HouseholdSettings,
  }
  return c.json(body)
})
