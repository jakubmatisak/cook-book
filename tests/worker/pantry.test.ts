import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { IngredientDto, PantryDto, RecipeDetailDto, RecipeSummaryDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

const pantry = async () => (await send(app, 'GET', api('/pantry'))).json<PantryDto>()
const ingredientId = async (name: string) =>
  (await (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()).find((i) => i.name === name)!
    .id

async function seedRecipes() {
  const make = (title: string, ingredients: string[], optional: string[] = []) =>
    send(app, 'POST', api('/recipes'), {
      title,
      ingredients: [
        ...ingredients.map((name) => ({ name, quantity: 1, unit: 'ks', isOptional: false })),
        ...optional.map((name) => ({ name, quantity: 1, unit: 'ks', isOptional: true })),
      ],
    })
  await make('Praženica', ['Vajcia', 'Cibuľa'], ['Pažítka'])
  await make('Palacinky', ['Vajcia', 'Mlieko', 'Múka'])
  await make('Guláš', ['Hovädzie mäso', 'Cibuľa', 'Paprika', 'Rasca'])
  await make('Chlieb s maslom', ['Chlieb', 'Maslo'])
}

describe('špajza', () => {
  it('označí ingrediencie ako doma a zruší označenie', async () => {
    await seedRecipes()
    const vajcia = await ingredientId('Vajcia')
    expect((await pantry()).ingredientIds).toEqual([])
    expect((await send(app, 'PUT', api(`/pantry/${vajcia}`))).status).toBe(204)
    expect((await send(app, 'PUT', api(`/pantry/${vajcia}`))).status).toBe(204)
    expect((await pantry()).ingredientIds).toEqual([vajcia])
    expect((await send(app, 'DELETE', api(`/pantry/${vajcia}`))).status).toBe(204)
    expect((await pantry()).ingredientIds).toEqual([])
  })

  it('ingrediencia inej domácnosti sa nedá označiť', async () => {
    await seedRecipes()
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into ingredients (id, household_id, name, name_normalized, aliases, created_at, updated_at) values ('ing-iny', 'iny', 'Soľ', 'sol', '[]', 'x', 'x')",
      ),
    ])
    expect((await send(app, 'PUT', api('/pantry/ing-iny'))).status).toBe(404)
  })
})

describe('recepty – čo viem uvariť', () => {
  it('zoradí recepty podľa počtu chýbajúcich ingrediencií a voliteľné nepočíta', async () => {
    await seedRecipes()
    for (const name of ['Vajcia', 'Cibuľa', 'Mlieko']) {
      await send(app, 'PUT', api(`/pantry/${await ingredientId(name)}`))
    }
    const res = await send(app, 'GET', api('/recipes?pantry=1'))
    expect(res.status).toBe(200)
    const list = await res.json<RecipeSummaryDto[]>()
    expect(list.map((r) => [r.title, r.missing])).toEqual([
      ['Praženica', []],
      ['Palacinky', ['Múka']],
      ['Chlieb s maslom', ['Chlieb', 'Maslo']],
      ['Guláš', ['Hovädzie mäso', 'Paprika', 'Rasca']],
    ])
  })

  it('bez filtra sa chýbajúce ingrediencie neposielajú a recept bez ingrediencií je „viem uvariť“', async () => {
    await send(app, 'POST', api('/recipes'), { title: 'Voda' })
    const plain = await (await send(app, 'GET', api('/recipes'))).json<RecipeSummaryDto[]>()
    expect(plain[0]!.missing).toBeUndefined()
    const withPantry = await (await send(app, 'GET', api('/recipes?pantry=1'))).json<RecipeSummaryDto[]>()
    expect(withPantry[0]).toMatchObject({ title: 'Voda', missing: [] })
  })

  it('kombinuje sa s vyhľadávaním a zmazaný recept sa neukáže', async () => {
    await seedRecipes()
    const recipes = await (await send(app, 'GET', api('/recipes'))).json<RecipeSummaryDto[]>()
    const gulas = recipes.find((r) => r.title === 'Guláš')!
    await send(app, 'DELETE', api(`/recipes/${gulas.id}`))
    const list = await (await send(app, 'GET', api('/recipes?pantry=1&q=cibul'))).json<RecipeSummaryDto[]>()
    expect(list.map((r) => r.title)).toEqual(['Praženica'])
  })
})

describe('detail receptu', () => {
  it('vracia, ktoré ingrediencie sú doma', async () => {
    await seedRecipes()
    await send(app, 'PUT', api(`/pantry/${await ingredientId('Vajcia')}`))
    const recipes = await (await send(app, 'GET', api('/recipes'))).json<RecipeSummaryDto[]>()
    const id = recipes.find((r) => r.title === 'Praženica')!.id
    const detail = await (await send(app, 'GET', api(`/recipes/${id}`))).json<RecipeDetailDto>()
    expect(detail.ingredients.map((i) => [i.name, i.inPantry])).toEqual([
      ['Vajcia', true],
      ['Cibuľa', false],
      ['Pažítka', false],
    ])
  })
})
