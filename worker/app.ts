import { Hono } from 'hono'
import type { AppEnv } from './env'
import { notFound, onError } from './errors'
import { authMiddleware, type AuthDeps } from './middleware/auth'
import { ingredientRoutes, shopCategoryRoutes, tagRoutes } from './routes/catalog'
import { exportRoutes } from './routes/export'
import { memberRoutes, settingsRoutes, slotRoutes } from './routes/family'
import { imageServeRoutes, imageUploadRoutes } from './routes/images'
import { meRoutes } from './routes/me'
import { pantryRoutes } from './routes/pantry'
import { planRoutes } from './routes/plan'
import { recipeRoutes } from './routes/recipes'
import { shoppingRoutes } from './routes/shopping'

export type AppDeps = AuthDeps

export function createApp(deps: AppDeps = {}) {
  const app = new Hono<AppEnv>()
  const auth = authMiddleware(deps)

  app.get('/api/v1/health', (c) => c.json({ ok: true }))

  app.use('/api/v1/*', auth)
  app.use('/img/*', auth)
  app.route('/api/v1/me', meRoutes)
  app.route('/api/v1/export', exportRoutes)
  app.route('/api/v1/recipes', recipeRoutes)
  app.route('/api/v1/ingredients', ingredientRoutes)
  app.route('/api/v1/tags', tagRoutes)
  app.route('/api/v1/shop-categories', shopCategoryRoutes)
  app.route('/api/v1/images', imageUploadRoutes)
  app.route('/api/v1/members', memberRoutes)
  app.route('/api/v1/slots', slotRoutes)
  app.route('/api/v1/settings', settingsRoutes)
  app.route('/api/v1/plan', planRoutes)
  app.route('/api/v1/shopping', shoppingRoutes)
  app.route('/api/v1/pantry', pantryRoutes)
  app.route('/img', imageServeRoutes)

  app.onError(onError)
  app.notFound(notFound)
  return app
}
