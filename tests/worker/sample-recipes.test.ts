import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, RecipeListDto, SampleRecipesResult } from '@shared/api'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { ensureUser } from '../../worker/services/household'
import { inviteMember } from '../../worker/services/memberships'
import { api, send } from './helpers'

const app = createApp()
const OWNER = 'ja@example.com'
const MEMBER = 'clen@example.com'
const as = (email: string) => ({ as: email })

const addSamples = async (by = OWNER) => {
  const res = await send(app, 'POST', api('/recipes/samples'), undefined, as(by))
  expect(res.status).toBe(200)
  return res.json<SampleRecipesResult>()
}
const titles = async () =>
  ((await (await send(app, 'GET', api('/recipes'), undefined, as(OWNER))).json()) as RecipeListDto).items.map(
    (r) => r.title,
  )

describe('ukážkové recepty na serveri', () => {
  it('pridáva sa po dávkach (kvôli limitu dopytov), až kým nie sú všetky 21', async () => {
    await ensureUser(getDb(env), OWNER)
    const first = await addSamples()
    expect(first.added).toBeGreaterThan(0)
    expect(first.added).toBeLessThanOrEqual(4)
    expect(first.remaining).toBe(21 - first.added)

    let total = first.added
    for (let guard = 0; guard < 10; guard++) {
      const next = await addSamples()
      total += next.added
      if (next.remaining === 0) break
    }
    expect(total).toBe(21)
    expect(await titles()).toHaveLength(21)
  })

  it('opakované volanie nič nezdvojí', async () => {
    await ensureUser(getDb(env), OWNER)
    for (let guard = 0; guard < 10; guard++) if ((await addSamples()).remaining === 0) break
    const again = await addSamples()
    expect(again).toEqual({ added: 0, remaining: 0 })
    expect(await titles()).toHaveLength(21)
  })

  it('preskočí recepty, ktoré domácnosť už má (podľa názvu bez diakritiky)', async () => {
    await ensureUser(getDb(env), OWNER)
    await send(app, 'POST', api('/recipes'), { title: 'bryndzove halusky', servings: 2 }, as(OWNER))
    for (let guard = 0; guard < 10; guard++) if ((await addSamples()).remaining === 0) break
    const all = await titles()
    expect(all).toHaveLength(21) // 20 ukážkových + vlastný
    expect(all.filter((t) => /halu/i.test(t))).toHaveLength(1)
  })

  it('pridané recepty majú ingrediencie a postup', async () => {
    await ensureUser(getDb(env), OWNER)
    await addSamples()
    const list = (await (
      await send(app, 'GET', api('/recipes'), undefined, as(OWNER))
    ).json()) as RecipeListDto
    const detail = await (
      await send(app, 'GET', api(`/recipes/${list.items[0]!.id}`), undefined, as(OWNER))
    ).json<{ ingredients: unknown[]; steps: unknown[] }>()
    expect(detail.ingredients.length).toBeGreaterThan(2)
    expect(detail.steps.length).toBeGreaterThan(1)
  })

  it('smie to len vlastník domácnosti', async () => {
    const owner = await ensureUser(getDb(env), OWNER)
    await inviteMember(getDb(env), owner.householdId, MEMBER, 'member')
    const res = await send(app, 'POST', api('/recipes/samples'), undefined, as(MEMBER))
    expect(res.status).toBe(403)
    expect((await res.json<ApiErrorBody>()).error.code).toBe('owner_required')
    expect(await titles()).toHaveLength(0)
  })
})

describe('detské ukážkové recepty na serveri', () => {
  const addKids = async (by = OWNER) => {
    const res = await send(app, 'POST', api('/recipes/samples?set=kids'), undefined, as(by))
    expect(res.status).toBe(200)
    return res.json<SampleRecipesResult>()
  }
  const kidsTitles = async () =>
    (
      (await (
        await send(app, 'GET', api('/recipes?category=detske'), undefined, as(OWNER))
      ).json()) as RecipeListDto
    ).items.map((r) => r.title)

  it('pridáva sa po dávkach, až kým nie je všetkých 23, v kategórii Detské', async () => {
    await ensureUser(getDb(env), OWNER)
    const first = await addKids()
    expect(first.added).toBeGreaterThan(0)
    expect(first.remaining).toBe(23 - first.added)
    for (let guard = 0; guard < 12; guard++) if ((await addKids()).remaining === 0) break
    expect(await kidsTitles()).toHaveLength(23)
  })

  it('opakované volanie nič nezdvojí a nepridá základné recepty', async () => {
    await ensureUser(getDb(env), OWNER)
    for (let guard = 0; guard < 12; guard++) if ((await addKids()).remaining === 0) break
    expect(await addKids()).toEqual({ added: 0, remaining: 0 })
    expect(await kidsTitles()).toHaveLength(23)
    expect(await titles()).toHaveLength(0) // v bežnom zozname sú detské skryté
  })

  it('základná a detská sada sú nezávislé', async () => {
    await ensureUser(getDb(env), OWNER)
    for (let guard = 0; guard < 12; guard++) if ((await addKids()).remaining === 0) break
    for (let guard = 0; guard < 10; guard++) if ((await addSamples()).remaining === 0) break
    expect(await titles()).toHaveLength(21)
    expect(await kidsTitles()).toHaveLength(23)
  })

  it('neznáma sada je chyba a člen domácnosti to nesmie', async () => {
    const owner = await ensureUser(getDb(env), OWNER)
    expect((await send(app, 'POST', api('/recipes/samples?set=xx'), undefined, as(OWNER))).status).toBe(400)
    await inviteMember(getDb(env), owner.householdId, MEMBER, 'member')
    expect((await send(app, 'POST', api('/recipes/samples?set=kids'), undefined, as(MEMBER))).status).toBe(
      403,
    )
  })
})
