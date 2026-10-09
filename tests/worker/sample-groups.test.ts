import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { RecipeDetailDto, RecipeListDto, SampleGroupStatusDto, SampleRecipesResult } from '@shared/api'
import { samplesOf } from '@shared/data/sampleSets'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { ensureUser } from '../../worker/services/household'
import { inviteMember } from '../../worker/services/memberships'
import { api, send } from './helpers'

const app = createApp()
const OWNER = 'ja@example.com'
const MEMBER = 'clen@example.com'
const as = (email: string) => ({ as: email })

const importAll = async (set: string) => {
  for (let guard = 0; guard < 30; guard++) {
    const res = await send(app, 'POST', api(`/recipes/samples?set=${set}`), undefined, as(OWNER))
    expect(res.status).toBe(200)
    if ((await res.json<SampleRecipesResult>()).remaining === 0) return
  }
  throw new Error('nedokončené')
}
const status = async () =>
  (await send(app, 'GET', api('/recipes/samples'), undefined, as(OWNER))).json<SampleGroupStatusDto[]>()
const statusOf = async (set: string) => (await status()).find((s) => s.set === set)!
const recipes = async (query = '') =>
  ((await (await send(app, 'GET', api(`/recipes${query}`), undefined, as(OWNER))).json()) as RecipeListDto)
    .items

describe('základné recepty po balíkoch', () => {
  it('stav ukáže každý balík s počtom receptov a koľko z nich domácnosť má', async () => {
    await ensureUser(getDb(env), OWNER)
    const before = await status()
    expect(before.map((s) => s.set)).toEqual([
      'ranajky',
      'desiata',
      'olovrant',
      'vecera',
      'polievky',
      'hlavne',
      'salaty',
      'dezerty',
      'kids',
    ])
    expect(before.find((s) => s.set === 'desiata')).toEqual({ set: 'desiata', total: 10, imported: 0 })
    await importAll('desiata')
    expect(await statusOf('desiata')).toEqual({ set: 'desiata', total: 10, imported: 10 })
    expect(await recipes()).toHaveLength(10)
  })

  it('starší import (rovnaký názov a popis, bez fotky) doplní namiesto zdvojenia', async () => {
    await ensureUser(getDb(env), OWNER)
    const sample = samplesOf('ranajky').find((r) => r.title === 'Miešané vajíčka')!
    const old = await (
      await send(
        app,
        'POST',
        api('/recipes'),
        { title: sample.title, description: sample.description, category: 'ranajky' },
        as(OWNER),
      )
    ).json<RecipeDetailDto>()
    await importAll('ranajky')
    const list = await recipes()
    expect(list.filter((r) => r.title === 'Miešané vajíčka').map((r) => r.id)).toEqual([old.id])
    expect(list.find((r) => r.id === old.id)!.alsoCategories).toEqual(['vecera'])
    expect(await statusOf('ranajky')).toMatchObject({ total: 12, imported: 12 })
  })

  it('vlastný rovnomenný recept nechá tak: nezdvojí ho ani ho nezaráta', async () => {
    await ensureUser(getDb(env), OWNER)
    await send(app, 'POST', api('/recipes'), { title: 'miesane vajicka', description: 'Moje' }, as(OWNER))
    await importAll('ranajky')
    expect((await recipes()).filter((r) => /miesane|Miešané/i.test(r.title))).toHaveLength(1)
    expect(await statusOf('ranajky')).toMatchObject({ total: 12, imported: 11 })
  })

  it('odstránenie balíka zmaže len jeho recepty, vlastné ostanú', async () => {
    await ensureUser(getDb(env), OWNER)
    await send(app, 'POST', api('/recipes'), { title: 'Môj chlebík', category: 'desiata' }, as(OWNER))
    await importAll('desiata')
    await importAll('vecera')
    const res = await send(app, 'POST', api('/recipes/samples/remove?set=desiata'), undefined, as(OWNER))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ removed: 10 })
    const titles = (await recipes()).map((r) => r.title)
    expect(titles).toContain('Môj chlebík')
    expect(titles).toHaveLength(11) // vlastný + 10 večerí
    expect(await statusOf('desiata')).toMatchObject({ imported: 0 })
  })

  it('import aj odstránenie smie len vlastník', async () => {
    const owner = await ensureUser(getDb(env), OWNER)
    await inviteMember(getDb(env), owner.householdId, MEMBER, 'member')
    expect((await send(app, 'POST', api('/recipes/samples?set=desiata'), undefined, as(MEMBER))).status).toBe(
      403,
    )
    expect(
      (await send(app, 'POST', api('/recipes/samples/remove?set=desiata'), undefined, as(MEMBER))).status,
    ).toBe(403)
  })
})
