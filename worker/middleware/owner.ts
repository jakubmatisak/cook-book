import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../env'
import { HttpError } from '../errors'

/** Zmeny pravidiel domácnosti (nastavenia, rodina, členovia, export) smie robiť len vlastník. */
export const requireOwner = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('user').role !== 'owner') {
    throw new HttpError(403, 'owner_required', 'Túto zmenu môže urobiť len vlastník domácnosti.')
  }
  await next()
})
