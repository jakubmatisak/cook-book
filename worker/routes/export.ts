import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { requireOwner } from '../middleware/owner'
import { todayInZone } from '../../shared/dates'
import { recipesToMarkdown, UTF8_BOM } from '../../shared/markdown'
import { exportHousehold } from '../services/export'
import { loadRecipesForMarkdown } from '../services/exportMarkdown'

export const exportRoutes = new Hono<AppEnv>()
  .get('/recipes.md', requireOwner, async (c) => {
    const recipes = await loadRecipesForMarkdown(c.get('db'), c.get('user').householdId)
    const date = todayInZone(new Date(), 'Europe/Bratislava')
    return c.body(UTF8_BOM + recipesToMarkdown(recipes), 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="kucharska-kniha-recepty-${date}.md"`,
      'Cache-Control': 'no-store',
    })
  })
  .get('/', requireOwner, async (c) => {
    const data = await exportHousehold(c.get('db'), c.get('user').householdId)
    const date = data.exportedAt.slice(0, 10)
    c.header('Content-Disposition', `attachment; filename="kucharska-kniha-${date}.json"`)
    c.header('Cache-Control', 'no-store')
    return c.json(data)
  })
