import { describe, expect, it } from 'vitest'
import type { IngredientDto, PantryDto, ShoppingItemDto, ShoppingListDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

async function listId() {
  const lists = await (await send(app, 'GET', api('/shopping/lists'))).json<ShoppingListDto[]>()
  return lists[0]!.id
}

const add = async (list: string, body: object) =>
  (await send(app, 'POST', api(`/shopping/lists/${list}/items`), body)).json<ShoppingItemDto>()
const check = (id: string) => send(app, 'PATCH', api(`/shopping/items/${id}`), { isChecked: true })
const pantry = async () => (await send(app, 'GET', api('/pantry'))).json<PantryDto>()
const ingredients = async () => (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()
const items = async (list: string) =>
  (await send(app, 'GET', api(`/shopping/lists/${list}/items`))).json<ShoppingItemDto[]>()

describe('Presunúť kúpené do špajze', () => {
  it('kúpené položky prejdú do špajze aj s množstvom a z nákupu zmiznú; nekúpené ostanú', async () => {
    const list = await listId()
    const mlieko = await add(list, { name: 'Mlieko', quantity: 2, unit: 'l' })
    const chlieb = await add(list, { name: 'Chlieb' })
    await add(list, { name: 'Syr', quantity: 200, unit: 'g' })
    await check(mlieko.id)
    await check(chlieb.id)

    const res = await send(app, 'POST', api(`/shopping/lists/${list}/move-to-pantry`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ moved: 2, removed: 2 })

    const names = new Map((await ingredients()).map((i) => [i.id, i.name]))
    const stock = await pantry()
    expect(stock.ingredientIds.map((id) => names.get(id)).sort()).toEqual(['Chlieb', 'Mlieko'])
    const milk = stock.items.find((i) => names.get(i.ingredientId) === 'Mlieko')
    expect(milk).toMatchObject({ quantity: 2, unit: 'l' })
    expect((await items(list)).map((i) => i.name)).toEqual(['Syr'])
  })

  it('k zásobe sa množstvo pripočíta aj v inej jednotke (1 kg + 500 g), nezlučiteľnú jednotku nechá', async () => {
    const list = await listId()
    const first = await add(list, { name: 'Múka', quantity: 500, unit: 'g' })
    await check(first.id)
    await send(app, 'POST', api(`/shopping/lists/${list}/move-to-pantry`))
    const second = await add(list, { name: 'Múka', quantity: 1, unit: 'kg' })
    const third = await add(list, { name: 'Múka', quantity: 250, unit: 'g' })
    await check(second.id)
    await check(third.id)
    await send(app, 'POST', api(`/shopping/lists/${list}/move-to-pantry`))
    const stock = await pantry()
    expect(stock.items).toHaveLength(1)
    expect(stock.items[0]).toMatchObject({ quantity: 1750, unit: 'g' })

    const balenie = await add(list, { name: 'Múka', quantity: 1, unit: 'balenie' })
    await check(balenie.id)
    await send(app, 'POST', api(`/shopping/lists/${list}/move-to-pantry`))
    expect((await pantry()).items[0]).toMatchObject({ quantity: 1750, unit: 'g' })
  })

  it('bez kúpených položiek nič nerobí; cudzí zoznam je 404', async () => {
    const list = await listId()
    const res = await send(app, 'POST', api(`/shopping/lists/${list}/move-to-pantry`))
    expect(await res.json()).toEqual({ moved: 0, removed: 0 })
    expect((await send(app, 'POST', api('/shopping/lists/cudzi/move-to-pantry'))).status).toBe(404)
  })
})
