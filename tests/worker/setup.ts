import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach } from 'vitest'

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

/** Poradie: deti pred rodičmi, aby mazanie neporušilo cudzie kľúče. */
const TABLES_CHILD_FIRST = [
  'shopping_item_sources',
  'shopping_items',
  'shopping_lists',
  'staple_items',
  'pantry_items',
  'week_template_entries',
  'week_templates',
  'cook_log',
  'meal_plan_entry_members',
  'meal_plan_entries',
  'meal_slots',
  'recipe_notes',
  'recipe_ratings',
  'recipe_favorites',
  'recipe_tags',
  'recipe_steps',
  'recipe_ingredients',
  'recipes',
  'images',
  'member_preferences',
  'tags',
  'ingredients',
  'shop_categories',
  'users',
  'family_members',
  'settings',
  'households',
]

// Úložisko D1 sa medzi testami jedného súboru nevynuluje – každý test začína s prázdnou databázou.
beforeEach(async () => {
  await env.DB.batch(TABLES_CHILD_FIRST.map((t) => env.DB.prepare(`delete from ${t}`)))
})
