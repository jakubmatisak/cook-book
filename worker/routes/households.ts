import { Hono, type Context } from 'hono'
import type { HouseholdAccountDto, HouseholdSummaryDto } from '../../shared/api'
import { householdNameSchema } from '../../shared/schemas/household'
import type { AppEnv } from '../env'
import { HttpError } from '../errors'
import { parseBody } from '../http'
import { isAllowedEmail } from '../services/accessList'
import { createOwnHousehold } from '../services/household'
import { toHouseholdSummary } from './me'

/**
 * Prvú vlastnú domácnosť si založí každý, koho pustil Cloudflare Access; ďalšie len správca inštancie
 * (ALLOWED_EMAILS), inak by si ich ktokoľvek mohol zakladať bez obmedzenia.
 */
const canCreate = (c: Context<AppEnv>) =>
  c.get('memberships').length === 0 || isAllowedEmail(c.get('user').email, c.env.ALLOWED_EMAILS)

/** Domácnosti prihláseného používateľa; fungujú aj bez výberu domácnosti (slúžia výberu a zakladaniu). */
export const householdsRoutes = new Hono<AppEnv>()
  .get('/', (c) => c.json(c.get('memberships').map(toHouseholdSummary)))
  .get('/account', (c) => {
    const body: HouseholdAccountDto = { email: c.get('user').email, canCreate: canCreate(c) }
    return c.json(body)
  })
  .post('/', async (c) => {
    const user = c.get('user')
    if (!canCreate(c)) {
      throw new HttpError(403, 'admin_required', 'Ďalšiu domácnosť môže založiť len správca aplikácie.')
    }
    const { name } = await parseBody(c, householdNameSchema)
    const { id } = await createOwnHousehold(c.get('db'), user.email, name)
    const body: HouseholdSummaryDto = { id, name, role: 'owner' }
    return c.json(body, 201)
  })
