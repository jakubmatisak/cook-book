import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

// D1 na free pláne má denný limit prečítaných riadkov. Bez indexu na recipe_ingredients.ingredient_id čítal zoznam
// ingrediencií (počet použití pre každú) celú tabuľku pre každú ingredienciu – ~200 000 riadkov na jedno otvorenie.
const plan = async (sql: string) =>
  (await env.DB.prepare(`explain query plan ${sql}`).all<{ detail: string }>()).results.map((r) => r.detail)

describe('plán dotazov', () => {
  it('počet použití ingrediencie hľadá v recipe_ingredients cez index, nie prechodom celej tabuľky', async () => {
    const details = await plan(
      `select count(*) from recipe_ingredients ri join recipes r on r.id = ri.recipe_id
       where ri.ingredient_id = 'x' and r.deleted_at is null`,
    )
    expect(
      details.some((d) => /SEARCH ri USING (COVERING )?INDEX recipe_ingredients_ingredient_idx/.test(d)),
    ).toBe(true)
  })

  it('zmazanie ingrediencie nekontroluje nákupné položky prechodom celej tabuľky', async () => {
    const details = await plan(`select 1 from shopping_items where ingredient_id = 'x'`)
    expect(details.some((d) => /USING (COVERING )?INDEX shopping_items_ingredient_idx/.test(d))).toBe(true)
  })

  it.each([
    [
      'odškrtnutie v Špajzi hľadá zásobu ingrediencie cez index',
      `select * from pantry_items where household_id = 'h' and ingredient_id = 'x'`,
      'pantry_items_household_ingredient_idx',
    ],
    [
      'zmazanie ingrediencie nekontroluje stále položky prechodom celej tabuľky',
      `select 1 from staple_items where ingredient_id = 'x'`,
      'staple_items_ingredient_idx',
    ],
    [
      'zmazanie ingrediencie nekontroluje preferencie členov prechodom celej tabuľky',
      `select 1 from member_preferences where ingredient_id = 'x'`,
      'member_preferences_ingredient_idx',
    ],
    [
      'uloženie receptu nehľadá zdroje nákupu prechodom celej tabuľky',
      `select 1 from shopping_item_sources where recipe_ingredient_id = 'x'`,
      'shopping_item_sources_recipe_ingredient_idx',
    ],
  ])('%s', async (_name, sql, indexName) => {
    const details = await plan(sql)
    expect(details.some((d) => new RegExp(`USING (COVERING )?INDEX ${indexName}\\b`).test(d))).toBe(true)
  })
})
