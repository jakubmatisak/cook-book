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
})
