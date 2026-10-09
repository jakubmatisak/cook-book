import { describe, expect, it } from 'vitest'
import type { ComposeItem } from '@shared/compose'
import type { MeResponse, PlanEntryDto, RecipeDetailDto, ShoppingItemDto, ShoppingListDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()
const MON = '2026-10-12'
const TUE = '2026-10-13'
const WED = '2026-10-14'

async function setup() {
  const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
  const obed = me.slots.find((s) => s.name === 'Obed')!.id
  const recipe = async (title: string, extra: object = {}) =>
    (
      await (
        await send(app, 'POST', api('/recipes'), {
          title,
          servings: 4,
          category: 'hlavne',
          ingredients: [{ name: 'Mäso', quantity: 400, unit: 'g', isOptional: false }],
          ...extra,
        })
      ).json<RecipeDetailDto>()
    ).id
  const gulas = await recipe('Guláš', { isVerified: true, cookMinutes: 90 })
  const rezen = await recipe('Rezeň', { cookMinutes: 20 })
  await send(app, 'POST', api('/members'), { name: 'Mama', kind: 'adult' })
  await send(app, 'POST', api('/members'), { name: 'Otec', kind: 'adult' })
  return { obed, gulas, rezen }
}

const compose = async (body: object) => {
  const res = await send(app, 'POST', api('/plan/compose'), body)
  expect(res.status).toBe(200)
  return res.json<ComposeItem[]>()
}
const plan = async (from = MON, to = WED) =>
  (await send(app, 'GET', api(`/plan?from=${from}&to=${to}`))).json<PlanEntryDto[]>()

describe('zostaviť jedálniček – návrh', () => {
  it('navrhne podľa štetcov a časového limitu, nič neuloží', async () => {
    const { obed, gulas, rezen } = await setup()
    const items = await compose({
      cells: [
        { date: MON, slotId: obed, brush: 'verified' },
        { date: TUE, slotId: obed, brush: 'all' },
      ],
      slots: [{ slotId: obed, categories: ['hlavne'], withSoup: false }],
      timeLimits: { [TUE]: 'do30' },
      tagIds: [],
      leftoverDays: 0,
      seed: 7,
    })
    expect(items.map((i) => [i.date, i.recipeId])).toEqual([
      [MON, gulas],
      [TUE, rezen],
    ])
    expect(await plan()).toEqual([])
  })

  it('cudzí slot je 400', async () => {
    await setup()
    const res = await send(app, 'POST', api('/plan/compose'), {
      cells: [{ date: MON, slotId: 'cudzi', brush: 'all' }],
      slots: [{ slotId: 'cudzi', categories: ['hlavne'], withSoup: false }],
      timeLimits: {},
      tagIds: [],
      leftoverDays: 0,
      seed: 1,
    })
    expect(res.status).toBe(400)
  })
})

describe('zostaviť jedálniček – potvrdenie a zvyšky', () => {
  async function applyWithLeftover() {
    const { obed, gulas, rezen } = await setup()
    const res = await send(app, 'POST', api('/plan/compose/apply'), {
      replace: false,
      items: [
        { key: 'a', date: MON, slotId: obed, recipeId: gulas, leftoverOf: null, leftoverDays: 1 },
        { key: 'b', date: TUE, slotId: obed, recipeId: gulas, leftoverOf: 'a', leftoverDays: 0 },
        { key: 'c', date: WED, slotId: obed, recipeId: rezen, leftoverOf: null, leftoverDays: 0 },
      ],
    })
    expect(res.status).toBe(201)
    return { obed, gulas, rezen }
  }

  it('uloží položky; uvarené jedlo má porcie na viac dní a zvyšky sú naviazané', async () => {
    const { gulas } = await applyWithLeftover()
    const entries = await plan()
    const cooked = entries.find((e) => e.date === MON)!
    const leftover = entries.find((e) => e.date === TUE)!
    expect(cooked.servingsOverride).toBe(4) // 2 dospelí × (1 + 1 deň zvyškov)
    expect(leftover.recipeId).toBe(gulas)
    expect(leftover.leftoverOfEntryId).toBe(cooked.id)
    expect(entries.find((e) => e.date === WED)!.leftoverOfEntryId).toBeNull()
  })

  it('nákup počíta suroviny len z varenia, nie zo zvyškov; zmazanie varenia zmaže aj zvyšky', async () => {
    await applyWithLeftover()
    const [list] = await (await send(app, 'GET', api('/shopping/lists'))).json<ShoppingListDto[]>()
    await send(app, 'POST', api(`/shopping/lists/${list!.id}/generate`), { from: MON, to: WED })
    const items = await (
      await send(app, 'GET', api(`/shopping/lists/${list!.id}/items`))
    ).json<ShoppingItemDto[]>()
    // Guláš 400 g na 4 porcie → 4 porcie = 400 g; Rezeň 400 g na 4 porcie → 2 porcie = 200 g.
    expect(items.find((i) => i.name === 'Mäso')?.quantity).toBe(600)

    const cooked = (await plan()).find((e) => e.date === MON)!
    await send(app, 'DELETE', api(`/plan/entries/${cooked.id}`))
    expect((await plan()).map((e) => e.date)).toEqual([WED])
  })

  it('s nahradením zmaže, čo v políčku bolo; bez neho obsadené políčko nechá', async () => {
    const { obed, rezen } = await setup()
    await send(app, 'POST', api('/plan/entries'), { date: MON, slotId: obed, freeText: 'Pizza' })
    await send(app, 'POST', api('/plan/compose/apply'), {
      replace: true,
      items: [{ key: 'a', date: MON, slotId: obed, recipeId: rezen, leftoverOf: null, leftoverDays: 0 }],
    })
    expect((await plan()).map((e) => e.freeText ?? e.recipeId)).toEqual([rezen])
  })

  it('uloží aj veľký návrh naraz (14 dní × 2 jedlá, nad limit parametrov D1)', async () => {
    const { obed, gulas, rezen } = await setup()
    const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
    const vecera = me.slots.find((s) => s.name === 'Večera')!.id
    const days = Array.from({ length: 14 }, (_, i) => `2026-10-${String(12 + i).padStart(2, '0')}`)
    const items = days.flatMap((date) => [
      { key: `${date}|o`, date, slotId: obed, recipeId: gulas, leftoverOf: null, leftoverDays: 0 },
      { key: `${date}|v`, date, slotId: vecera, recipeId: rezen, leftoverOf: null, leftoverDays: 0 },
    ])
    const res = await send(app, 'POST', api('/plan/compose/apply'), { replace: true, items })
    expect(res.status).toBe(201)
    expect(await plan(days[0], days[13])).toHaveLength(28)
  })

  it('cudzí recept je 400 a nič sa neuloží', async () => {
    const { obed } = await setup()
    const res = await send(app, 'POST', api('/plan/compose/apply'), {
      replace: false,
      items: [{ key: 'a', date: MON, slotId: obed, recipeId: 'cudzi', leftoverOf: null, leftoverDays: 0 }],
    })
    expect(res.status).toBe(400)
    expect(await plan()).toEqual([])
  })
})
