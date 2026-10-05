import { describe, expect, it } from 'vitest'
import type { MeResponse, PlanEntryDto, RecipeDetailDto, RecipeListDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, count, send } from './helpers'

const app = createApp()

async function setup() {
  const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
  const slotId = me.slots[0]!.id
  const make = async (title: string) =>
    (await (await send(app, 'POST', api('/recipes'), { title, servings: 4 })).json<RecipeDetailDto>()).id
  const plan = async (recipeId: string, date: string) => {
    const res = await send(app, 'POST', api('/plan/entries'), { date, slotId, recipeId })
    expect(res.status).toBe(201)
    return res.json<PlanEntryDto>()
  }
  return { make, plan }
}

const list = async (query = '') => (await send(app, 'GET', api(`/recipes${query}`))).json<RecipeListDto>()

describe('uvarené z jedálnička', () => {
  it('uloží posledné varenie podľa minulých dní a budúce ignoruje', async () => {
    const { make, plan } = await setup()
    const gulas = await make('Guláš')
    const rizoto = await make('Rizoto')
    await make('Palacinky')
    await plan(gulas, '2020-01-05')
    await plan(gulas, '2020-03-09')
    await plan(rizoto, '2099-01-01')

    const { items } = await list()
    const by = Object.fromEntries(items.map((r) => [r.title, r.lastCookedAt]))
    expect(by).toEqual({ Guláš: '2020-03-09', Rizoto: null, Palacinky: null })
    expect(await count('cook_log')).toBe(2)
  })

  it('je idempotentné a dopĺňa len nové záznamy', async () => {
    const { make, plan } = await setup()
    const gulas = await make('Guláš')
    await plan(gulas, '2020-01-05')
    await list()
    await list()
    expect(await count('cook_log')).toBe(1)
    await plan(gulas, '2020-02-01')
    await list()
    expect(await count('cook_log')).toBe(2)
  })

  it('záznam v jedálničku bez receptu sa nezapočíta', async () => {
    const { make } = await setup()
    await make('Guláš')
    const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
    await send(app, 'POST', api('/plan/entries'), {
      date: '2020-01-05',
      slotId: me.slots[0]!.id,
      freeText: 'Zvyšky',
    })
    await list()
    expect(await count('cook_log')).toBe(0)
  })
})

describe('uvarené po úprave jedálnička', () => {
  it('presun záznamu na iný deň odstráni starý záznam o varení a doplní nový', async () => {
    const { make, plan } = await setup()
    const gulas = await make('Guláš')
    const entry = await plan(gulas, '2020-01-05')
    expect((await list()).items[0]!.lastCookedAt).toBe('2020-01-05')
    const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
    const res = await send(app, 'PUT', api(`/plan/entries/${entry.id}`), {
      date: '2020-02-10',
      slotId: me.slots[0]!.id,
      recipeId: gulas,
    })
    expect(res.status).toBe(200)
    expect((await list()).items[0]!.lastCookedAt).toBe('2020-02-10')
    expect(await count('cook_log')).toBe(1)
  })

  it('zmena receptu v zázname presunie varenie na nový recept', async () => {
    const { make, plan } = await setup()
    const gulas = await make('Guláš')
    const rizoto = await make('Rizoto')
    const entry = await plan(gulas, '2020-01-05')
    await list()
    const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
    await send(app, 'PUT', api(`/plan/entries/${entry.id}`), {
      date: '2020-01-05',
      slotId: me.slots[0]!.id,
      recipeId: rizoto,
    })
    const by = Object.fromEntries((await list()).items.map((r) => [r.title, r.lastCookedAt]))
    expect(by).toEqual({ Guláš: null, Rizoto: '2020-01-05' })
  })

  it('zmazanie záznamu zruší aj varenie, úprava poznámky ho nechá', async () => {
    const { make, plan } = await setup()
    const gulas = await make('Guláš')
    const entry = await plan(gulas, '2020-01-05')
    await list()
    const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
    await send(app, 'PUT', api(`/plan/entries/${entry.id}`), {
      date: '2020-01-05',
      slotId: me.slots[0]!.id,
      recipeId: gulas,
      note: 'bez soli',
    })
    expect((await list()).items[0]!.lastCookedAt).toBe('2020-01-05')
    expect(await count('cook_log')).toBe(1)

    await send(app, 'DELETE', api(`/plan/entries/${entry.id}`))
    expect((await list()).items[0]!.lastCookedAt).toBeNull()
    expect(await count('cook_log')).toBe(0)
  })
})
