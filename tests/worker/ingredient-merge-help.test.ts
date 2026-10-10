import { describe, expect, it } from 'vitest'
import type { IngredientDto } from '@shared/api'
import { api, send } from './helpers'
import { A, app, as, B, setupHouseholds } from './sharingHelpers'

async function recipeWith(
  by: string,
  title: string,
  ingredients: { name: string; quantity: number; unit: string }[],
) {
  const res = await send(
    app,
    'POST',
    api('/recipes'),
    { title, servings: 4, category: 'hlavne', ingredients, steps: [{ text: 'Uvar.' }], tags: [] },
    as(by),
  )
  expect(res.status).toBe(201)
}

const ingredientsOf = async (by: string) =>
  (await (await send(app, 'GET', api('/ingredients'), undefined, as(by))).json<IngredientDto[]>()).reduce<
    Record<string, string>
  >((acc, i) => ({ ...acc, [i.name]: i.id }), {})

describe('pomoc pri zlučovaní ingrediencií', () => {
  it('ignorované návrhy si pamätá domácnosť (nie iná)', async () => {
    await setupHouseholds()
    const get = async (by: string) =>
      (await send(app, 'GET', api('/ingredients/merge-ignored'), undefined, as(by))).json<string[]>()
    expect(await get(A)).toEqual([])
    const res = await send(app, 'POST', api('/ingredients/merge-ignored'), { ids: ['b', 'a'] }, as(A))
    expect(res.status).toBe(200)
    await send(app, 'POST', api('/ingredients/merge-ignored'), { ids: ['a', 'b'] }, as(A))
    expect(await get(A)).toEqual(['a,b'])
    expect(await get(B)).toEqual([])
  })

  it('povie, v akých jednotkách sa ingrediencie používajú; cudzie ingrediencie vynechá', async () => {
    await setupHouseholds()
    await recipeWith(A, 'Šalát', [
      { name: 'Paradajka', quantity: 2, unit: 'ks' },
      { name: 'Paradajky', quantity: 300, unit: 'g' },
    ])
    await recipeWith(A, 'Omáčka', [{ name: 'Paradajky', quantity: 1, unit: 'kg' }])
    await recipeWith(B, 'Svokrin šalát', [{ name: 'Uhorka', quantity: 1, unit: 'ks' }])
    const mine = await ingredientsOf(A)
    const foreign = (await ingredientsOf(B))['Uhorka']!
    const ids = [mine['Paradajka']!, mine['Paradajky']!, foreign].join(',')
    const res = await send(app, 'GET', api(`/ingredients/units?ids=${ids}`), undefined, as(A))
    expect(res.status).toBe(200)
    const units = await res.json<Record<string, string[]>>()
    expect(units).toEqual({ [mine['Paradajka']!]: ['ks'], [mine['Paradajky']!]: ['g', 'kg'] })
  })
})
