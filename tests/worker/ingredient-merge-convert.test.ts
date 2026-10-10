import { describe, expect, it } from 'vitest'
import type { IngredientDto, PantryDto, RecipeDetailDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

const recipe = async (title: string, ingredient: string, quantity: number, unit: string) =>
  (
    await send(app, 'POST', api('/recipes'), {
      title,
      servings: 2,
      ingredients: [{ name: ingredient, quantity, unit, isOptional: false }],
    })
  ).json<RecipeDetailDto>()
const byName = async (name: string) =>
  (await (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()).find((i) => i.name === name)!
const detail = async (id: string) => (await send(app, 'GET', api(`/recipes/${id}`))).json<RecipeDetailDto>()

describe('zlúčenie s prepočtom jednotiek', () => {
  it('prepočíta množstvá v receptoch (1 ks = 10 g) a ostatné jednotky nechá', async () => {
    const r1 = await recipe('Guláš', 'Čili paprička', 2, 'ks')
    const r2 = await recipe('Omáčka', 'Čili papričky', 30, 'g')
    const target = await byName('Čili papričky')
    const source = await byName('Čili paprička')
    const res = await send(app, 'POST', api('/ingredients/merge'), {
      targetId: target.id,
      sourceIds: [source.id],
      convert: [{ from: 'ks', to: 'g', factor: 10 }],
    })
    expect(res.status).toBe(200)
    expect((await detail(r1.id)).ingredients.map((i) => [i.name, i.quantity, i.unit])).toEqual([
      ['Čili papričky', 20, 'g'],
    ])
    expect((await detail(r2.id)).ingredients.map((i) => [i.quantity, i.unit])).toEqual([[30, 'g']])
  })

  it('v špajzi prepočíta a sčíta zásoby', async () => {
    await recipe('Guláš', 'Čili paprička', 2, 'ks')
    await recipe('Omáčka', 'Čili papričky', 30, 'g')
    const target = await byName('Čili papričky')
    const source = await byName('Čili paprička')
    await send(app, 'PUT', api(`/pantry/${source.id}`), { quantity: 2, unit: 'ks' })
    await send(app, 'PUT', api(`/pantry/${target.id}`), { quantity: 30, unit: 'g' })
    await send(app, 'POST', api('/ingredients/merge'), {
      targetId: target.id,
      sourceIds: [source.id],
      convert: [{ from: 'ks', to: 'g', factor: 10 }],
    })
    const pantry = await (await send(app, 'GET', api('/pantry'))).json<PantryDto>()
    expect(pantry.items.map((i) => [i.ingredientId, i.quantity, i.unit])).toEqual([[target.id, 50, 'g']])
  })

  it('odmietne nezmyselný prepočet', async () => {
    await recipe('Guláš', 'Čili paprička', 2, 'ks')
    await recipe('Omáčka', 'Čili papričky', 30, 'g')
    const target = await byName('Čili papričky')
    const source = await byName('Čili paprička')
    for (const convert of [[{ from: 'ks', to: 'g', factor: 0 }], [{ from: 'g', to: 'g', factor: 2 }]]) {
      const res = await send(app, 'POST', api('/ingredients/merge'), {
        targetId: target.id,
        sourceIds: [source.id],
        convert,
      })
      expect(res.status).toBe(400)
    }
  })
})
