import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type {
  GenerateResult,
  IngredientDto,
  MeResponse,
  RecipeDetailDto,
  ShopCategoryDto,
  ShoppingItemDto,
  ShoppingListDto,
} from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

async function setup() {
  const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
  const obed = me.slots.find((s) => s.name === 'Obed')!.id
  const vecera = me.slots.find((s) => s.name === 'Večera')!.id
  for (const [name, kind] of [
    ['Mama', 'adult'],
    ['Tato', 'adult'],
    ['Ema', 'child'],
    ['Jakub', 'child'],
  ]) {
    await send(app, 'POST', api('/members'), { name, kind })
  }
  const gulas = await (
    await send(app, 'POST', api('/recipes'), {
      title: 'Guláš',
      servings: 4,
      ingredients: [
        { name: 'Hovädzie mäso', quantity: 800, unit: 'g', isOptional: false },
        { name: 'Vajcia', quantity: 3, unit: 'ks', isOptional: false },
        { name: 'Rasca', quantity: 1, unit: 'ČL', isOptional: true },
      ],
    })
  ).json<RecipeDetailDto>()
  const palacinky = await (
    await send(app, 'POST', api('/recipes'), {
      title: 'Palacinky',
      servings: 3,
      ingredients: [
        { name: 'Vajcia', quantity: 2, unit: 'ks', isOptional: false },
        { name: 'Mlieko', quantity: 0.5, unit: 'l', isOptional: false },
      ],
    })
  ).json<RecipeDetailDto>()
  const lists = await (await send(app, 'GET', api('/shopping/lists'))).json<ShoppingListDto[]>()
  return { obed, vecera, gulas, palacinky, listId: lists[0]!.id }
}

const plan = (slotId: string, recipeId: string, date = '2026-10-05') =>
  send(app, 'POST', api('/plan/entries'), { date, slotId, recipeId })

const generate = async (listId: string, from = '2026-10-05', to = '2026-10-11') => {
  const res = await send(app, 'POST', api(`/shopping/lists/${listId}/generate`), { from, to })
  expect(res.status).toBe(200)
  return res.json<GenerateResult>()
}

const items = async (listId: string, as?: string) => {
  const res = await send(app, 'GET', api(`/shopping/lists/${listId}/items`), undefined, { as })
  expect(res.status).toBe(200)
  return res.json<ShoppingItemDto[]>()
}

const byName = (list: ShoppingItemDto[], name: string) => list.find((i) => i.name === name)!

describe('nákupný zoznam – generovanie', () => {
  it('vygeneruje položky s porciami rodiny, pôvodom a kategóriou obchodu', async () => {
    const { obed, gulas, listId } = await setup()
    const lists = await (await send(app, 'GET', api('/shopping/lists'))).json<ShoppingListDto[]>()
    expect(lists).toEqual([{ id: listId, name: 'Nákup', isDefault: true }])

    const categories = await (await send(app, 'GET', api('/shop-categories'))).json<ShopCategoryDto[]>()
    const maso = (await (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()).find(
      (i) => i.name === 'Hovädzie mäso',
    )!
    await send(app, 'PUT', api(`/ingredients/${maso.id}`), {
      shopCategoryId: categories.find((c) => c.name === 'Mäso a ryby')!.id,
    })
    await plan(obed, gulas.id)

    expect(await generate(listId)).toMatchObject({ added: 2, kept: 0, removed: 0 })
    const list = await items(listId)
    expect(list.map((i) => [i.name, i.quantity, i.unit, i.source, i.isChecked])).toEqual([
      ['Hovädzie mäso', 600, 'g', 'generated', false],
      ['Vajcia', 3, 'ks', 'generated', false],
    ])
    expect(byName(list, 'Hovädzie mäso').sources).toEqual([
      { date: '2026-10-05', recipeTitle: 'Guláš', coverImageUrl: null },
    ])
  })

  it('sčíta ingrediencie z viacerých jedál a ignoruje jedlá mimo rozsahu', async () => {
    const { obed, vecera, gulas, palacinky, listId } = await setup()
    await plan(obed, gulas.id)
    await plan(vecera, palacinky.id, '2026-10-06')
    await plan(vecera, palacinky.id, '2026-10-20')
    await generate(listId)
    const list = await items(listId)
    // Vajcia: guláš 3 × 3/4 = 2,25 + palacinky 2 × 3/3 = 2 → 4,25 → 5 ks
    expect(byName(list, 'Vajcia')).toMatchObject({ quantity: 5, unit: 'ks' })
    expect(byName(list, 'Mlieko')).toMatchObject({ quantity: 500, unit: 'ml' })
    expect(byName(list, 'Vajcia').sources).toHaveLength(2)
  })

  it('opätovné generovanie nahradí nekúpené, nechá kúpené a ručné a nič nezdvojí', async () => {
    const { obed, vecera, gulas, palacinky, listId } = await setup()
    await plan(obed, gulas.id)
    await generate(listId)
    const first = await items(listId)
    await send(app, 'PATCH', api(`/shopping/items/${byName(first, 'Hovädzie mäso').id}`), { isChecked: true })
    await send(app, 'POST', api(`/shopping/lists/${listId}/items`), { name: 'Toaletný papier' })

    await plan(vecera, palacinky.id, '2026-10-06')
    expect(await generate(listId)).toMatchObject({ added: 2, kept: 1, removed: 1 })

    const list = await items(listId)
    expect(list.filter((i) => i.name === 'Hovädzie mäso')).toHaveLength(1)
    expect(byName(list, 'Hovädzie mäso').isChecked).toBe(true)
    expect(byName(list, 'Vajcia')).toMatchObject({ quantity: 5, isChecked: false })
    expect(byName(list, 'Toaletný papier').source).toBe('manual')
    expect(list).toHaveLength(4)
  })

  it('rozsah nad 31 dní je 400, cudzí zoznam 404', async () => {
    const { listId } = await setup()
    const long = await send(app, 'POST', api(`/shopping/lists/${listId}/generate`), {
      from: '2026-10-01',
      to: '2026-12-01',
    })
    expect(long.status).toBe(400)
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into shopping_lists (id, household_id, name, is_default, sort_order, created_at, updated_at) values ('l-iny', 'iny', 'Cudzí', 1, 0, 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into shopping_items (id, list_id, name, is_checked, source, sort_order, created_at, updated_at) values ('i-iny', 'l-iny', 'Cudzia položka', 0, 'manual', 0, 'x', 'x')",
      ),
    ])
    expect((await send(app, 'GET', api('/shopping/lists/l-iny/items'))).status).toBe(404)
    expect(
      (
        await send(app, 'POST', api('/shopping/lists/l-iny/generate'), {
          from: '2026-10-05',
          to: '2026-10-05',
        })
      ).status,
    ).toBe(404)
    expect((await send(app, 'PATCH', api('/shopping/items/i-iny'), { isChecked: true })).status).toBe(404)
    expect((await send(app, 'DELETE', api('/shopping/items/i-iny'))).status).toBe(404)
  })

  it('položka ostane s pôvodným názvom aj po zmazaní ingrediencie z katalógu', async () => {
    const { obed, gulas, listId } = await setup()
    await plan(obed, gulas.id)
    await generate(listId)
    await env.DB.prepare("update ingredients set deleted_at = 'x'").run()
    expect((await items(listId)).map((i) => i.name)).toEqual(['Hovädzie mäso', 'Vajcia'])
  })
})

describe('nákupný zoznam – ručné položky a odškrtávanie', () => {
  it('ručná položka prevezme kategóriu známej ingrediencie', async () => {
    const { listId } = await setup()
    const zelenina = (await (await send(app, 'GET', api('/shop-categories'))).json<ShopCategoryDto[]>())[0]!
    const mlieko = (await (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()).find(
      (i) => i.name === 'Mlieko',
    )!
    await send(app, 'PUT', api(`/ingredients/${mlieko.id}`), { shopCategoryId: zelenina.id })

    const res = await send(app, 'POST', api(`/shopping/lists/${listId}/items`), {
      name: 'mlieko',
      quantity: 2,
      unit: 'l',
    })
    expect(res.status).toBe(201)
    expect(await res.json<ShoppingItemDto>()).toMatchObject({
      name: 'mlieko',
      quantity: 2,
      unit: 'l',
      ingredientId: mlieko.id,
      shopCategoryId: zelenina.id,
      source: 'manual',
    })
  })

  it('odškrtnutie dvoch položiek dvoma ľuďmi naraz zachová obe', async () => {
    const { listId } = await setup()
    const a = await (
      await send(app, 'POST', api(`/shopping/lists/${listId}/items`), { name: 'Chlieb' })
    ).json<ShoppingItemDto>()
    const b = await (
      await send(app, 'POST', api(`/shopping/lists/${listId}/items`), { name: 'Maslo' })
    ).json<ShoppingItemDto>()
    await Promise.all([
      send(app, 'PATCH', api(`/shopping/items/${a.id}`), { isChecked: true }),
      send(app, 'PATCH', api(`/shopping/items/${b.id}`), { isChecked: true }, { as: 'manzelka@example.com' }),
    ])
    const list = await items(listId, 'manzelka@example.com')
    expect(list.map((i) => [i.name, i.isChecked])).toEqual([
      ['Chlieb', true],
      ['Maslo', true],
    ])
    expect(byName(list, 'Chlieb').checkedAt).not.toBeNull()

    await send(app, 'PATCH', api(`/shopping/items/${a.id}`), { isChecked: false })
    expect(byName(await items(listId), 'Chlieb')).toMatchObject({ isChecked: false, checkedAt: null })
  })

  it('dávka z offline režimu použije len zmeny novšie ako posledná úprava', async () => {
    const { listId } = await setup()
    const a = await (
      await send(app, 'POST', api(`/shopping/lists/${listId}/items`), { name: 'Chlieb' })
    ).json<ShoppingItemDto>()
    const b = await (
      await send(app, 'POST', api(`/shopping/lists/${listId}/items`), { name: 'Maslo' })
    ).json<ShoppingItemDto>()
    const old = '2020-01-01T00:00:00.000Z'
    const future = new Date(Date.now() + 60_000).toISOString()
    const res = await send(app, 'POST', api('/shopping/items/batch'), {
      changes: [
        { id: a.id, isChecked: true, at: future },
        { id: b.id, isChecked: true, at: old },
        { id: 'neexistuje', isChecked: true, at: future },
      ],
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ applied: 1 })
    const list = await items(listId)
    expect([byName(list, 'Chlieb').isChecked, byName(list, 'Maslo').isChecked]).toEqual([true, false])
  })

  it('vymaže kúpené a jednotlivú položku', async () => {
    const { listId } = await setup()
    const a = await (
      await send(app, 'POST', api(`/shopping/lists/${listId}/items`), { name: 'Chlieb' })
    ).json<ShoppingItemDto>()
    const b = await (
      await send(app, 'POST', api(`/shopping/lists/${listId}/items`), { name: 'Maslo' })
    ).json<ShoppingItemDto>()
    await send(app, 'POST', api(`/shopping/lists/${listId}/items`), { name: 'Syr' })
    await send(app, 'PATCH', api(`/shopping/items/${a.id}`), { isChecked: true })
    expect((await send(app, 'POST', api(`/shopping/lists/${listId}/clear-checked`))).status).toBe(200)
    expect((await send(app, 'DELETE', api(`/shopping/items/${b.id}`))).status).toBe(204)
    expect((await items(listId)).map((i) => i.name)).toEqual(['Syr'])
  })
})

describe('nákupný zoznam – úprava položky', () => {
  it('odmietne kategóriu inej domácnosti a prázdnu zmenu zvládne bez chyby', async () => {
    const { listId } = await setup()
    const item = await (
      await send(app, 'POST', api(`/shopping/lists/${listId}/items`), { name: 'Chlieb' })
    ).json<ShoppingItemDto>()
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into shop_categories (id, household_id, name, sort_order, created_at, updated_at) values ('kat-iny', 'iny', 'Cudzia', 0, 'x', 'x')",
      ),
    ])
    expect(
      (await send(app, 'PATCH', api(`/shopping/items/${item.id}`), { shopCategoryId: 'kat-iny' })).status,
    ).toBe(400)
    const empty = await send(app, 'PATCH', api(`/shopping/items/${item.id}`), {})
    expect(empty.status).toBe(200)
    expect((await empty.json<ShoppingItemDto>()).name).toBe('Chlieb')
  })
})

describe('nákupný zoznam – fotky zdrojov', () => {
  it('zdroj položky nesie fotku receptu, keď ju má', async () => {
    const { obed, listId } = await setup()
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 9, 9])
    const form = new FormData()
    form.append('file', new File([webp], 'fotka.webp', { type: 'image/webp' }))
    const image = await (await send(app, 'POST', api('/images'), form)).json<{ id: string; url: string }>()
    const recipe = await (
      await send(app, 'POST', api('/recipes'), {
        title: 'Fotený',
        servings: 2,
        coverImageId: image.id,
        ingredients: [{ name: 'Ryža', quantity: 200, unit: 'g', isOptional: false }],
      })
    ).json<RecipeDetailDto>()
    await send(app, 'POST', api('/plan/entries'), { date: '2026-10-05', slotId: obed, recipeId: recipe.id })
    await generate(listId)
    const rice = (await items(listId)).find((i) => i.name === 'Ryža')!
    expect(rice.sources).toEqual([{ date: '2026-10-05', recipeTitle: 'Fotený', coverImageUrl: image.url }])
  })
})
