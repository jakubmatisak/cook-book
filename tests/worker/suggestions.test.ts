import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { FamilyMemberDto, IngredientDto, MeResponse, RecipeDetailDto, SuggestionDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

const DATE = '2026-10-05'

async function seed() {
  const recipe = async (title: string, ingredients: string[], extra: object = {}) =>
    (
      await (
        await send(app, 'POST', api('/recipes'), {
          title,
          servings: 4,
          prepMinutes: 10,
          cookMinutes: 20,
          ingredients: ingredients.map((name) => ({ name, quantity: 1, unit: 'ks', isOptional: false })),
          ...extra,
        })
      ).json<RecipeDetailDto>()
    ).id
  const prazenica = await recipe('Praženica', ['Vajcia', 'Cibuľa'])
  const gulas = await recipe('Guláš', ['Hovädzie', 'Cibuľa', 'Paprika'])
  const palacinky = await recipe('Palacinky', ['Vajcia', 'Mlieko', 'Múka'])
  const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
  const slotId = me.slots.find((s) => s.name === 'Obed')!.id
  const ingredients = await (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()
  const ing = (name: string) => ingredients.find((i) => i.name === name)!.id
  return { prazenica, gulas, palacinky, slotId, ing }
}

const suggest = async (date = DATE) => {
  const res = await send(app, 'GET', api(`/recipes/suggestions?date=${date}`))
  expect(res.status).toBe(200)
  return res.json<SuggestionDto[]>()
}
const titles = (s: SuggestionDto[]) => s.map((x) => x.title)

describe('GET /recipes/suggestions', () => {
  it('bez receptov vráti prázdny zoznam', async () => {
    expect(await suggest()).toEqual([])
  })

  it('recept s kompletnou špajzou ide prvý a dôvody hovoria prečo', async () => {
    const { ing } = await seed()
    for (const name of ['Vajcia', 'Cibuľa']) await send(app, 'PUT', api(`/pantry/${ing(name)}`))
    const result = await suggest()
    expect(titles(result)[0]).toBe('Praženica')
    expect(result[0]).toMatchObject({
      title: 'Praženica',
      totalMinutes: 30,
      missing: [],
      coverImageUrl: null,
    })
    expect(result[0]!.reasons).toEqual(['Máš všetko doma', 'Zatiaľ nevarené'])
    const gulas = result.find((s) => s.title === 'Guláš')!
    expect(gulas.missing).toEqual(['Hovädzie', 'Paprika'])
    expect(gulas.reasons[0]).toBe('Chýba: Hovädzie, Paprika')
  })

  it('už naplánované recepty v okolí dňa sa nenavrhujú, vzdialené áno', async () => {
    const { prazenica, gulas, slotId } = await seed()
    await send(app, 'POST', api('/plan/entries'), { date: '2026-10-07', slotId, recipeId: prazenica })
    await send(app, 'POST', api('/plan/entries'), { date: '2026-10-20', slotId, recipeId: gulas })
    const result = titles(await suggest())
    expect(result).not.toContain('Praženica')
    expect(result).toContain('Guláš')
  })

  it('odvodí posledné varenie z minulého jedálnička', async () => {
    const { gulas, slotId } = await seed()
    await send(app, 'POST', api('/plan/entries'), { date: '2020-01-05', slotId, recipeId: gulas })
    const result = await suggest()
    expect(result.find((s) => s.title === 'Guláš')!.reasons).toContain('Naposledy pred viac ako rokom')
    expect(result.find((s) => s.title === 'Praženica')!.reasons).toContain('Zatiaľ nevarené')
  })

  it('recept s alergénom pre niekoho z rodiny sa nenavrhuje', async () => {
    const { ing } = await seed()
    const member = await (
      await send(app, 'POST', api('/members'), { name: 'Mama', kind: 'adult' })
    ).json<FamilyMemberDto>()
    await send(app, 'PUT', api(`/members/${member.id}/preferences`), { allergies: [ing('Mlieko')] })
    expect(titles(await suggest())).toEqual(['Guláš', 'Praženica'])
  })

  it('exspirovaná zásoba neráta ako doma', async () => {
    const { ing } = await seed()
    await send(app, 'PUT', api(`/pantry/${ing('Vajcia')}`), {
      quantity: 6,
      unit: 'ks',
      expiresOn: '2026-10-01',
    })
    await send(app, 'PUT', api(`/pantry/${ing('Cibuľa')}`), { quantity: 2, unit: 'ks', expiresOn: DATE })
    const result = await suggest()
    expect(result.find((s) => s.title === 'Praženica')!.missing).toEqual(['Vajcia'])
  })

  it('zmazané recepty a recepty inej domácnosti sa nenavrhujú', async () => {
    const { palacinky } = await seed()
    await send(app, 'DELETE', api(`/recipes/${palacinky}`))
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into recipes (id, household_id, title, title_normalized, slug, category, servings, difficulty, created_at, updated_at) values ('r-iny', 'iny', 'Cudzí', 'cudzi', 'cudzi', 'hlavne', 4, 1, 'x', 'x')",
      ),
    ])
    expect(titles(await suggest()).sort()).toEqual(['Guláš', 'Praženica'])
  })

  it('vráti najviac šesť návrhov', async () => {
    for (let i = 0; i < 8; i++)
      await send(app, 'POST', api('/recipes'), { title: `Recept ${i}`, servings: 2 })
    expect(await suggest()).toHaveLength(6)
  })

  it('neplatný alebo chýbajúci dátum je 400', async () => {
    expect((await send(app, 'GET', api('/recipes/suggestions'))).status).toBe(400)
    expect((await send(app, 'GET', api('/recipes/suggestions?date=zajtra'))).status).toBe(400)
  })
})
