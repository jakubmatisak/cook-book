import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, HouseholdSummaryDto, MeResponse, RecipeSummaryDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { createHousehold, ensureUser } from '../../worker/services/household'
import { addMembership, inviteMember, listMemberships } from '../../worker/services/memberships'
import { api, count, send } from './helpers'

const app = createApp()
const db = () => getDb(env)

const ME = 'ja@example.com' // v ALLOWED_EMAILS (vitest.config.ts)
const STRANGER = 'host@example.com' // nie je v ALLOWED_EMAILS

async function me(as: string, h?: string) {
  return send(app, 'GET', api(`/me${h ? `?h=${h}` : ''}`), undefined, { as })
}

/** Správca (ja@) a druhá domácnosť, v ktorej je tiež vlastníkom. */
async function withTwoHouseholds() {
  const first = await ensureUser(db(), ME)
  const other = await createHousehold(db(), 'Rodičia')
  await addMembership(db(), first.id, other, 'owner')
  return { first, firstId: first.householdId, otherId: other }
}

describe('členstvo a rola', () => {
  it('prvý prihlásený je vlastník a ďalší povolený e-mail je člen tej istej domácnosti', async () => {
    const first = await (await me(ME)).json<MeResponse>()
    expect(first.user.role).toBe('owner')
    expect(first.households).toEqual([{ id: first.household.id, name: first.household.name, role: 'owner' }])

    const second = await (await me('manzelka@example.com')).json<MeResponse>()
    expect(second.household.id).toBe(first.household.id)
    expect(second.user.role).toBe('member')
    expect(await count('households')).toBe(1)
    expect(await count('household_members')).toBe(2)
  })

  it('pozvaný e-mail mimo ALLOWED_EMAILS prejde, bez pozvánky je 403', async () => {
    const owner = await ensureUser(db(), ME)
    expect((await me(STRANGER)).status).toBe(403)

    await inviteMember(db(), owner.householdId, STRANGER, 'member')
    const res = await me(STRANGER)
    expect(res.status).toBe(200)
    const body = await res.json<MeResponse>()
    expect(body.user.role).toBe('member')
    expect(body.household.id).toBe(owner.householdId)
  })

  it('odobratý člen mimo ALLOWED_EMAILS je 403 no_household a do pôvodnej domácnosti sa nedostane', async () => {
    const owner = await ensureUser(db(), ME)
    const invited = await inviteMember(db(), owner.householdId, STRANGER, 'member')
    await env.DB.prepare('delete from household_members where user_id = ?').bind(invited.id).run()
    const res = await me(STRANGER)
    expect(res.status).toBe(403)
    expect((await res.json<ApiErrorBody>()).error.code).toBe('no_household')
    const old = await send(app, 'GET', api(`/recipes?h=${owner.householdId}`), undefined, { as: STRANGER })
    expect(old.status).toBe(403)
  })

  it('lastLoginAt sa zapíše pri prihlásení a nemení sa častejšie ako raz za hodinu', async () => {
    await me(ME)
    const read = async () =>
      (await env.DB.prepare('select last_login_at as t from household_members').first<{ t: string | null }>())
        ?.t ?? null
    const first = await read()
    expect(first).not.toBeNull()
    await me(ME)
    expect(await read()).toBe(first)

    await env.DB.prepare("update household_members set last_login_at = '2020-01-01T00:00:00.000Z'").run()
    await me(ME)
    expect(await read()).not.toBe('2020-01-01T00:00:00.000Z')
  })
})

describe('výber aktívnej domácnosti (?h=)', () => {
  it('viac domácností bez h je 400 household_required, zoznam domácností funguje aj bez h', async () => {
    await withTwoHouseholds()
    const res = await me(ME)
    expect(res.status).toBe(400)
    expect((await res.json<ApiErrorBody>()).error.code).toBe('household_required')

    const list = await send(app, 'GET', api('/households'), undefined, { as: ME })
    expect(list.status).toBe(200)
    const households = await list.json<HouseholdSummaryDto[]>()
    expect(households.map((h) => h.name).sort()).toEqual(['Naša domácnosť', 'Rodičia'])
    expect(households.every((h) => h.role === 'owner')).toBe(true)
  })

  it('h vyberie domácnosť a rola platí pre ňu', async () => {
    const { first, otherId } = await withTwoHouseholds()
    await env.DB.prepare('update household_members set role = ? where user_id = ? and household_id = ?')
      .bind('member', first.id, otherId)
      .run()

    const mine = await (await me(ME, first.householdId)).json<MeResponse>()
    expect(mine.household.id).toBe(first.householdId)
    expect(mine.user.role).toBe('owner')

    const theirs = await (await me(ME, otherId)).json<MeResponse>()
    expect(theirs.household.name).toBe('Rodičia')
    expect(theirs.user.role).toBe('member')
    expect(theirs.households).toHaveLength(2)
  })

  it('h cudzej alebo neexistujúcej domácnosti je 403', async () => {
    const first = await ensureUser(db(), ME)
    const foreign = await createHousehold(db(), 'Cudzia')
    await inviteMember(db(), foreign, STRANGER, 'owner')

    expect((await me(ME, foreign)).status).toBe(403)
    expect((await me(ME, 'neexistuje')).status).toBe(403)
    expect((await me(STRANGER, first.householdId)).status).toBe(403)
  })

  it('jedna domácnosť funguje aj bez h', async () => {
    const res = await me(ME)
    expect(res.status).toBe(200)
  })

  it('recepty a nákupný zoznam jednej domácnosti nie sú vidieť v druhej', async () => {
    const { firstId, otherId } = await withTwoHouseholds()
    const at = (path: string, h: string) => api(`${path}${path.includes('?') ? '&' : '?'}h=${h}`)

    const created = await send(
      app,
      'POST',
      at('/recipes', firstId),
      { title: 'Guláš', ingredients: [], steps: [], tags: [] },
      { as: ME },
    )
    expect(created.status).toBe(201)

    const mineRecipes = await (
      await send(app, 'GET', at('/recipes', firstId), undefined, { as: ME })
    ).json<{
      items: RecipeSummaryDto[]
    }>()
    expect(mineRecipes.items.map((r) => r.title)).toEqual(['Guláš'])
    const otherRecipes = await (
      await send(app, 'GET', at('/recipes', otherId), undefined, { as: ME })
    ).json<{
      items: RecipeSummaryDto[]
    }>()
    expect(otherRecipes.items).toEqual([])

    const lists = async (h: string) =>
      (
        await (
          await send(app, 'GET', at('/shopping/lists', h), undefined, { as: ME })
        ).json<{ id: string }[]>()
      ).map((l) => l.id)
    const [mineLists, otherLists] = [await lists(firstId), await lists(otherId)]
    expect(mineLists.length).toBeGreaterThan(0)
    expect(otherLists.length).toBeGreaterThan(0)
    expect(mineLists.filter((id) => otherLists.includes(id))).toEqual([])
  })

  it('listMemberships vráti domácnosti s rolou a názvom', async () => {
    const { first, otherId } = await withTwoHouseholds()
    const memberships = await listMemberships(db(), first.id)
    expect(memberships.map((m) => m.householdId).sort()).toEqual([first.householdId, otherId].sort())
  })
})

describe('správca aplikácie', () => {
  it('/me hovorí, či je používateľ správca (e-mail zo ALLOWED_EMAILS), kvôli zakladaniu domácností', async () => {
    const owner = await ensureUser(db(), ME)
    await inviteMember(db(), owner.householdId, STRANGER, 'owner')
    expect((await (await me(ME)).json<MeResponse>()).user.isAdmin).toBe(true)
    expect((await (await me(STRANGER)).json<MeResponse>()).user.isAdmin).toBe(false)
  })
})
