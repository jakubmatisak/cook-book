import { Hono } from 'hono'
import type { HouseholdSummaryDto } from '../../shared/api'
import { householdNameSchema } from '../../shared/schemas/household'
import type { AppEnv } from '../env'
import { HttpError } from '../errors'
import { parseBody } from '../http'
import { isAllowedEmail } from '../services/accessList'
import { createHousehold } from '../services/household'
import { addMembership } from '../services/memberships'
import { toHouseholdSummary } from './me'

/** Domácnosti prihláseného používateľa; fungujú aj bez výberu domácnosti (slúžia výberu a zakladaniu). */
export const householdsRoutes = new Hono<AppEnv>()
  .get('/', (c) => c.json(c.get('memberships').map(toHouseholdSummary)))
  .post('/', async (c) => {
    const user = c.get('user')
    // Ďalšie domácnosti zakladá len správca inštancie, inak by ich mohol zakladať ktokoľvek s e-mailom.
    if (!isAllowedEmail(user.email, c.env.ALLOWED_EMAILS)) {
      throw new HttpError(403, 'admin_required', 'Novú domácnosť môže založiť len správca aplikácie.')
    }
    const { name } = await parseBody(c, householdNameSchema)
    const db = c.get('db')
    const id = await createHousehold(db, name)
    await addMembership(db, user.id, id, 'owner')
    const body: HouseholdSummaryDto = { id, name, role: 'owner' }
    return c.json(body, 201)
  })
