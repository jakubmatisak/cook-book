import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

const EXPECTED = [
  'households', 'users', 'family_members', 'member_preferences', 'shop_categories', 'ingredients', 'images',
  'recipes', 'recipe_ingredients', 'recipe_steps', 'tags', 'recipe_tags', 'recipe_favorites', 'recipe_ratings',
  'recipe_notes', 'cook_log', 'meal_slots', 'meal_plan_entries', 'meal_plan_entry_members', 'week_templates',
  'week_template_entries', 'shopping_lists', 'shopping_items', 'shopping_item_sources', 'staple_items',
  'pantry_items', 'settings',
]

describe('schéma', () => {
  it('migrácie vytvoria všetky tabuľky', async () => {
    const { results } = await env.DB.prepare("select name from sqlite_master where type='table'").all<{
      name: string
    }>()
    const names = results.map((r) => r.name)
    for (const table of EXPECTED) expect(names).toContain(table)
  })

  it('cudzie kľúče sú vynútené', async () => {
    await expect(
      env.DB.prepare(
        "insert into users (id, household_id, email, name, created_at, updated_at) values ('u1','neexistuje','a@b.c','A','x','x')",
      ).run(),
    ).rejects.toThrow(/FOREIGN KEY/)
  })
})
