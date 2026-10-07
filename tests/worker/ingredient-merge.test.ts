import { describe, expect, it } from 'vitest'
import type {
  ApiErrorBody,
  IngredientDto,
  PantryDto,
  RecipeDetailDto,
  ShoppingItemDto,
  ShoppingListDto,
} from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

const recipe = async (title: string, ingredient: string, quantity = 2) =>
  (
    await send(app, 'POST', api('/recipes'), {
      title,
      servings: 2,
      ingredients: [{ name: ingredient, quantity, unit: 'ks', isOptional: false }],
    })
  ).json<RecipeDetailDto>()

const ingredients = async () => (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()
const byName = async (name: string) => (await ingredients()).find((i) => i.name === name)!
const merge = (body: object) => send(app, 'POST', api('/ingredients/merge'), body)

describe('zlúčenie ingrediencií', () => {
  it('prepíše recepty na ponechanú ingredienciu a zlúčenú zmaže', async () => {
    await recipe('Banánový chlieb', 'Banán')
    await recipe('Smoothie', 'Banány')
    const banan = await byName('Banán')
    const banany = await byName('Banány')

    const res = await merge({ targetId: banan.id, sourceIds: [banany.id] })
    expect(res.status).toBe(200)
    expect(await res.json<IngredientDto>()).toMatchObject({ id: banan.id, name: 'Banán', usageCount: 2 })

    expect((await ingredients()).map((i) => i.name)).not.toContain('Banány')
    const detail = await (
      await send(app, 'GET', api(`/recipes/${(await recipe('Ďalší', 'Mrkva')).id}`))
    ).json<RecipeDetailDto>()
    expect(detail.ingredients[0]!.name).toBe('Mrkva')
    const recipes = await (
      await send(app, 'GET', api('/recipes?q=smoothie'))
    ).json<{ items: { id: string }[] }>()
    const smoothie = await (
      await send(app, 'GET', api(`/recipes/${recipes.items[0]!.id}`))
    ).json<RecipeDetailDto>()
    expect(smoothie.ingredients.map((i) => [i.ingredientId, i.name])).toEqual([[banan.id, 'Banán']])
  })

  it('zlúčený názov si ingrediencia pamätá: ďalší recept s „Banány“ použije Banán a duplikát nevznikne', async () => {
    await recipe('A', 'Banán')
    await recipe('B', 'Banány')
    const banan = await byName('Banán')
    await merge({ targetId: banan.id, sourceIds: [(await byName('Banány')).id] })

    const next = await recipe('C', 'banány')
    expect(next.ingredients[0]!.ingredientId).toBe(banan.id)
    expect((await ingredients()).filter((i) => i.name.toLowerCase().startsWith('banán'))).toHaveLength(1)
  })

  it('v špajzi sčíta zásoby, nákup a stále položky prevedie na ponechanú', async () => {
    await recipe('A', 'Banán')
    await recipe('B', 'Banány')
    const banan = await byName('Banán')
    const banany = await byName('Banány')
    await send(app, 'PUT', api(`/pantry/${banan.id}`), { quantity: 2, unit: 'ks' })
    await send(app, 'PUT', api(`/pantry/${banany.id}`), { quantity: 3, unit: 'ks' })
    const lists = await (await send(app, 'GET', api('/shopping/lists'))).json<ShoppingListDto[]>()
    const item = await (
      await send(app, 'POST', api(`/shopping/lists/${lists[0]!.id}/items`), { name: 'Banány', quantity: 6 })
    ).json<ShoppingItemDto>()
    expect(item.ingredientId).toBe(banany.id)
    await send(app, 'POST', api('/staples'), { name: 'Banány', quantity: 1, unit: 'ks' })

    expect((await merge({ targetId: banan.id, sourceIds: [banany.id] })).status).toBe(200)

    const pantry = await (await send(app, 'GET', api('/pantry'))).json<PantryDto>()
    expect(pantry.items.map((i) => [i.ingredientId, i.quantity, i.unit])).toEqual([[banan.id, 5, 'ks']])
    const shopping = await (
      await send(app, 'GET', api(`/shopping/lists/${lists[0]!.id}/items`))
    ).json<ShoppingItemDto[]>()
    expect(shopping.map((i) => i.ingredientId)).toEqual([banan.id])
    const staples = await (await send(app, 'GET', api('/staples'))).json<{ ingredientId: string }[]>()
    expect(staples.map((s) => s.ingredientId)).toEqual([banan.id])
  })

  it('ponechanú ingredienciu môže rovno premenovať, aj na názov zlučovanej', async () => {
    await recipe('A', 'Banán')
    await recipe('B', 'Banány')
    const banan = await byName('Banán')
    const res = await merge({ targetId: banan.id, sourceIds: [(await byName('Banány')).id], name: 'Banány' })
    expect(await res.json<IngredientDto>()).toMatchObject({ id: banan.id, name: 'Banány' })
    expect((await ingredients()).filter((i) => i.name === 'Banány')).toHaveLength(1)
  })

  it('neplatné zlúčenie je 400, cudzia alebo neexistujúca ingrediencia 404', async () => {
    await recipe('A', 'Banán')
    const banan = await byName('Banán')
    const same = await merge({ targetId: banan.id, sourceIds: [banan.id] })
    expect(same.status).toBe(400)
    expect((await same.json<ApiErrorBody>()).error.code).toBeTruthy()
    expect((await merge({ targetId: banan.id, sourceIds: [] })).status).toBe(400)
    expect((await merge({ targetId: banan.id, sourceIds: ['neexistuje'] })).status).toBe(404)
  })
})
