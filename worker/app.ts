import { Hono } from 'hono'
import type { AppEnv } from './env'
import { notFound, onError } from './errors'
import { createMiddleware } from 'hono/factory'
import { authMiddleware, requireHousehold, type AuthDeps } from './middleware/auth'
import { ingredientRoutes, shopCategoryRoutes, tagRoutes } from './routes/catalog'
import { exportRoutes } from './routes/export'
import { memberRoutes, settingsRoutes, slotRoutes } from './routes/family'
import { householdRoutes } from './routes/household'
import { householdsRoutes } from './routes/households'
import { imageServeRoutes, imageUploadRoutes } from './routes/images'
import { meRoutes } from './routes/me'
import { pantryRoutes } from './routes/pantry'
import { planRoutes } from './routes/plan'
import { publicRoutes } from './routes/public'
import { recipeRoutes } from './routes/recipes'
import { shoppingRoutes } from './routes/shopping'
import { stapleRoutes } from './routes/staples'

export interface AppDeps extends AuthDeps {
  /** Sieťové volania importu receptov; v testoch falošné, inak globálny `fetch`. */
  fetchFn?: typeof fetch
}

export function createApp(deps: AppDeps = {}) {
  const app = new Hono<AppEnv>()
  const auth = authMiddleware(deps)

  app.get('/api/v1/health', (c) => c.json({ ok: true }))

  app.use(
    '/api/v1/*',
    createMiddleware<AppEnv>(async (c, next) => {
      c.set('fetchFn', deps.fetchFn ?? ((...args) => fetch(...args)))
      await next()
    }),
  )
  app.use('/api/v1/*', auth)
  app.use('/api/v1/*', requireHousehold)
  app.use('/img/*', auth)
  app.route('/api/v1/households', householdsRoutes)
  app.route('/api/v1/household', householdRoutes)
  app.route('/api/v1/me', meRoutes)
  app.route('/api/v1/export', exportRoutes)
  app.route('/api/v1/recipes', recipeRoutes)
  app.route('/api/v1/public', publicRoutes)
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
  app.route('/api/v1/staples', stapleRoutes)
  app.route('/img', imageServeRoutes)

  app.onError(onError)
  app.notFound(notFound)
  return app
}
