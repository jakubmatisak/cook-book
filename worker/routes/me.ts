import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { HouseholdSummaryDto, MeResponse } from '../../shared/api'
import { familyMembers, households, mealSlots, settings } from '../db/schema'
import type { AppEnv } from '../env'
import { HttpError } from '../errors'
import { parseBody } from '../http'
import { userSettingsUpdateSchema } from '../../shared/schemas/userSettings'
import { getUserSettings, updateUserSettings } from '../services/userSettings'
import { isAllowedEmail } from '../services/accessList'
import type { Membership } from '../services/memberships'
import {
  groupPreferences,
  mergeSettings,
  preferenceRowsQuery,
  toMemberDto,
  toSlotDto,
} from '../services/family'

export const toHouseholdSummary = (m: Membership): HouseholdSummaryDto => ({
  id: m.householdId,
  name: m.name,
  role: m.role,
})

export const meRoutes = new Hono<AppEnv>()
  .put('/settings', async (c) => {
    const patch = await parseBody(c, userSettingsUpdateSchema)
    return c.json(await updateUserSettings(c.get('db'), c.get('user').id, patch))
  })
  .get('/', async (c) => {
    const db = c.get('db')
    const user = c.get('user')
    const hid = user.householdId

    const userSettingsDto = await getUserSettings(db, user.id)
    const [householdRows, memberRows, slotRows, settingRows, prefRows] = await db.batch([
      db.select().from(households).where(eq(households.id, hid)),
      db
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.householdId, hid))
        .orderBy(asc(familyMembers.sortOrder), asc(familyMembers.name)),
      db.select().from(mealSlots).where(eq(mealSlots.householdId, hid)).orderBy(asc(mealSlots.sortOrder)),
      db
        .select({ key: settings.key, value: settings.value })
        .from(settings)
        .where(eq(settings.householdId, hid)),
      preferenceRowsQuery(db, hid),
    ])

    const household = householdRows[0]
    if (!household) throw new HttpError(500, 'household_missing', 'Domácnosť používateľa neexistuje.')

    const prefs = groupPreferences(prefRows)
    const body: MeResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        memberId: user.memberId,
        role: user.role,
        isAdmin: isAllowedEmail(user.email, c.env.ALLOWED_EMAILS),
      },
      household: { id: household.id, name: household.name },
      households: c.get('memberships').map(toHouseholdSummary),
      userSettings: userSettingsDto,
      members: memberRows.map((m) => toMemberDto(m, prefs.get(m.id))),
      slots: slotRows.map(toSlotDto),
      settings: mergeSettings(settingRows),
    }
    return c.json(body)
  })
