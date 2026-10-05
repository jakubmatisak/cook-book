import { Hono } from 'hono'
import type { AppEnv } from './env'
import { notFound, onError } from './errors'
import { authMiddleware, type AuthDeps } from './middleware/auth'
import { exportRoutes } from './routes/export'
import { meRoutes } from './routes/me'

export type AppDeps = AuthDeps

export function createApp(deps: AppDeps = {}) {
  const app = new Hono<AppEnv>().basePath('/api/v1')

  app.get('/health', (c) => c.json({ ok: true }))

  app.use('*', authMiddleware(deps))
  app.route('/me', meRoutes)
  app.route('/export', exportRoutes)

  app.onError(onError)
  app.notFound(notFound)
  return app
}
