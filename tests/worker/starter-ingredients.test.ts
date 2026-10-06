import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { IngredientDto, ShopCategoryDto, StarterIngredientsResult } from '@shared/api'
import { STARTER_INGREDIENTS } from '@shared/data/starterIngredients'
import { createApp } from '../../worker/app'
import { DEFAULT_SHOP_CATEGORIES } from '../../worker/services/household'
import { api, count, send } from './helpers'

const app = createApp()

const addStarter = async () => {
  const res = await send(app, 'POST', api('/ingredients/starter'))
  expect(res.status).toBe(200)
  return res.json<StarterIngredientsResult>()
}
const ingredients = async () => (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()
const categories = async () => (await send(app, 'GET', api('/shop-categories'))).json<ShopCategoryDto[]>()

describe('štartovací zoznam: dáta', () => {
  it('každá kategória v zozname je jednou z kategórií obchodu domácnosti', () => {
    for (const item of STARTER_INGREDIENTS) {
      expect(DEFAULT_SHOP_CATEGORIES as readonly string[], item.name).toContain(item.category)
    }
  })
})

describe('POST /ingredients/starter', () => {
  it('pridá základné suroviny s jednotkou a kategóriou obchodu', async () => {
    const result = await addStarter()
    expect(result).toMatchObject({ added: STARTER_INGREDIENTS.length, total: STARTER_INGREDIENTS.length })
    // odpoveď nesie pridané položky, aby klient nemusel sťahovať celý zoznam
    expect(result.items).toHaveLength(STARTER_INGREDIENTS.length)

    const list = await ingredients()
    expect(list).toHaveLength(STARTER_INGREDIENTS.length)
    const cats = await categories()
    const zemiaky = list.find((i) => i.name === 'Zemiaky')!
    expect(zemiaky).toMatchObject({ defaultUnit: 'g', usageCount: 0 })
    expect(zemiaky.shopCategoryId).toBe(cats.find((c) => c.name === 'Zelenina')!.id)
    expect(list.filter((i) => i.shopCategoryId === null)).toEqual([])
  })

  it('opakované volanie nič nepridá ani nezduplikuje', async () => {
    await addStarter()
    expect(await addStarter()).toEqual({ added: 0, total: STARTER_INGREDIENTS.length, items: [] })
    expect(await count('ingredients')).toBe(STARTER_INGREDIENTS.length)
  })

  it('už existujúcu ingredienciu (aj s inou diakritikou) nezduplikuje ani neprepíše', async () => {
    await send(app, 'POST', api('/recipes'), {
      title: 'Cibuľová polievka',
      ingredients: [{ name: 'cibula', quantity: 2, unit: 'ks', isOptional: false }],
    })
    const [created] = await ingredients()
    const iné = (await categories()).find((c) => c.name === 'Iné')!
    await send(app, 'PUT', api(`/ingredients/${created!.id}`), { shopCategoryId: iné.id, defaultUnit: 'kg' })

    const result = await addStarter()
    expect(result.added).toBe(STARTER_INGREDIENTS.length - 1)
    const list = await ingredients()
    expect(list.filter((i) => i.name.toLowerCase().startsWith('cib'))).toHaveLength(1)
    expect(list.find((i) => i.id === created!.id)).toMatchObject({
      name: 'cibula',
      shopCategoryId: iné.id,
      defaultUnit: 'kg',
      usageCount: 1,
    })
  })

  it('zmazanú ingredienciu nevráti späť', async () => {
    await addStarter()
    const zemiaky = (await ingredients()).find((i) => i.name === 'Zemiaky')!
    await env.DB.prepare('update ingredients set deleted_at = ? where id = ?')
      .bind('2026-01-01T00:00:00.000Z', zemiaky.id)
      .run()
    expect(await addStarter()).toMatchObject({ added: 0 })
    expect((await ingredients()).some((i) => i.name === 'Zemiaky')).toBe(false)
  })

  it('nezasiahne ingrediencie inej domácnosti', async () => {
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into ingredients (id, household_id, name, name_normalized, aliases, created_at, updated_at) values ('ing-iny', 'iny', 'Zemiaky', 'zemiaky', '[]', 'x', 'x')",
      ),
    ])
    await addStarter()
    const other = await env.DB.prepare(
      "select count(*) as n from ingredients where household_id = 'iny'",
    ).first<{
      n: number
    }>()
    expect(other?.n).toBe(1)
    // moja domácnosť dostala všetky, aj Zemiaky, hoci ich má cudzia domácnosť
    expect((await ingredients()).some((i) => i.name === 'Zemiaky')).toBe(true)
  })
})
