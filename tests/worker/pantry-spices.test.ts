import { describe, expect, it } from 'vitest'
import type { IngredientDto, MeResponse, RecipeListDto, ShopCategoryDto, SuggestionDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

const ingredientId = async (name: string) =>
  (await (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()).find((i) => i.name === name)!
    .id

/** Guláš (mäso, cibuľa + koreniny), Praženica (vajcia, cibuľa + soľ), Chlieb s maslom (chlieb, maslo). */
async function seed() {
  const make = (title: string, names: string[]) =>
    send(app, 'POST', api('/recipes'), {
      title,
      ingredients: names.map((name) => ({ name, quantity: 1, unit: 'ks', isOptional: false })),
    })
  await make('Guláš', ['Hovädzie mäso', 'Cibuľa', 'Rasca', 'Soľ'])
  await make('Praženica', ['Vajcia', 'Cibuľa', 'Soľ'])
  await make('Chlieb s maslom', ['Chlieb', 'Maslo'])
  const categories = await (await send(app, 'GET', api('/shop-categories'))).json<ShopCategoryDto[]>()
  const spices = categories.find((c) => c.name === 'Koreniny a dochucovadlá')!
  for (const name of ['Rasca', 'Soľ']) {
    await send(app, 'PUT', api(`/ingredients/${await ingredientId(name)}`), { shopCategoryId: spices.id })
  }
  for (const name of ['Cibuľa', 'Vajcia']) await send(app, 'PUT', api(`/pantry/${await ingredientId(name)}`))
}

const ignoreSpices = (value: boolean) => send(app, 'PUT', api('/settings'), { ignoreSpicesInPantry: value })
const list = async (query: string) => {
  const res = await send(app, 'GET', api(`/recipes${query}`))
  expect(res.status).toBe(200)
  return res.json<RecipeListDto>()
}
const missingOf = (result: RecipeListDto) => Object.fromEntries(result.items.map((r) => [r.title, r.missing]))

describe('ignorovanie korenín pri hodnotení špajze', () => {
  it('predvolene je vypnuté a koreniny sa počítajú ako chýbajúce', async () => {
    await seed()
    const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
    expect(me.settings.ignoreSpicesInPantry).toBe(false)
    expect(missingOf(await list('?pantry=1'))).toEqual({
      Guláš: ['Hovädzie mäso', 'Rasca', 'Soľ'],
      Praženica: ['Soľ'],
      'Chlieb s maslom': ['Chlieb', 'Maslo'],
    })
  })

  it('po zapnutí sa koreniny nepočítajú, takže Praženica je „viem uvariť“', async () => {
    await seed()
    expect((await ignoreSpices(true)).status).toBe(200)
    expect(missingOf(await list('?pantry=1'))).toEqual({
      Guláš: ['Hovädzie mäso'],
      Praženica: [],
      'Chlieb s maslom': ['Chlieb', 'Maslo'],
    })
  })

  it('nastavenie sa dá vypnúť a neplatná hodnota je 400', async () => {
    await seed()
    await ignoreSpices(true)
    await ignoreSpices(false)
    expect(missingOf(await list('?pantry=1')).Praženica).toEqual(['Soľ'])
    expect((await send(app, 'PUT', api('/settings'), { ignoreSpicesInPantry: 'áno' })).status).toBe(400)
  })

  it('ak domácnosť nemá kategóriu korenín, nič sa neignoruje', async () => {
    await seed()
    await ignoreSpices(true)
    const categories = await (await send(app, 'GET', api('/shop-categories'))).json<ShopCategoryDto[]>()
    const { env } = await import('cloudflare:workers')
    await env.DB.prepare('update shop_categories set name = ? where id = ?')
      .bind('Iné veci', categories.find((c) => c.name === 'Koreniny a dochucovadlá')!.id)
      .run()
    expect(missingOf(await list('?pantry=1')).Praženica).toEqual(['Soľ'])
  })

  it('návrhy „čo uvariť dnes“ ich ignorujú tiež', async () => {
    await seed()
    const suggest = async () =>
      (
        await (await send(app, 'GET', api('/recipes/suggestions?date=2026-10-05'))).json<SuggestionDto[]>()
      ).find((s) => s.title === 'Praženica')!
    expect((await suggest()).missing).toEqual(['Soľ'])
    await ignoreSpices(true)
    const after = await suggest()
    expect(after.missing).toEqual([])
    expect(after.reasons).toContain('Máš všetko doma')
  })
})

describe('filter „chýba najviac N surovín“', () => {
  it('missing=0 nechá len recepty, ktoré viem uvariť, missing=1 aj tie s jednou chýbajúcou', async () => {
    await seed()
    await ignoreSpices(true)
    expect(Object.keys(missingOf(await list('?pantry=1&missing=0')))).toEqual(['Praženica'])
    // Guláš chýba len mäso, Chlieb chýbajú dve
    expect(Object.keys(missingOf(await list('?pantry=1&missing=1'))).sort()).toEqual(['Guláš', 'Praženica'])
  })

  it('odpoveď nesie počty podľa počtu chýbajúcich', async () => {
    await seed()
    await ignoreSpices(true)
    const result = await list('?pantry=1&missing=0')
    expect(result.facets.missing).toEqual({ 0: 1, 1: 1, 2: 1 })
  })

  it('bez „Čo viem uvariť“ sa filter ignoruje a vráti všetky recepty', async () => {
    await seed()
    expect((await list('?missing=0')).items).toHaveLength(3)
  })

  it('neplatná hodnota je 400', async () => {
    expect((await send(app, 'GET', api('/recipes?pantry=1&missing=-1'))).status).toBe(400)
    expect((await send(app, 'GET', api('/recipes?pantry=1&missing=abc'))).status).toBe(400)
  })
})
