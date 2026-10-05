import { Hono } from 'hono'
import type { AppEnv } from './env'
import { notFound, onError } from './errors'
import { authMiddleware, type AuthDeps } from './middleware/auth'
import { ingredientRoutes, shopCategoryRoutes, tagRoutes } from './routes/catalog'
import { exportRoutes } from './routes/export'
import { meRoutes } from './routes/me'
import { recipeRoutes } from './routes/recipes'

export type AppDeps = AuthDeps

export function createApp(deps: AppDeps = {}) {
  const app = new Hono<AppEnv>()
  const auth = authMiddleware(deps)

  app.get('/api/v1/health', (c) => c.json({ ok: true }))

  app.use('/api/v1/*', auth)
  app.route('/api/v1/me', meRoutes)
  app.route('/api/v1/export', exportRoutes)
  app.route('/api/v1/recipes', recipeRoutes)
  app.route('/api/v1/ingredients', ingredientRoutes)
  app.route('/api/v1/tags', tagRoutes)
  app.route('/api/v1/shop-categories', shopCategoryRoutes)

  app.onError(onError)
  app.notFound(notFound)
  return app
}
