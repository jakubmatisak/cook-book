import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { toHouseholdSummary } from './me'

/** Domácnosti prihláseného používateľa; funguje aj bez výberu domácnosti (slúži výberu). */
export const householdsRoutes = new Hono<AppEnv>().get('/', (c) =>
  c.json(c.get('memberships').map(toHouseholdSummary)),
)
