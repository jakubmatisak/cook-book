import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, HouseholdMemberDto, HouseholdSummaryDto, MeResponse } from '@shared/api'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { createHousehold, ensureUser } from '../../worker/services/household'
import { addMembership, inviteMember } from '../../worker/services/memberships'
import { api, count, send } from './helpers'

const app = createApp()

const OWNER = 'ja@example.com' // prvý prihlásený = vlastník, zo zoznamu správcov
const MEMBER = 'manzelka@example.com' // zo zoznamu správcov, člen
const GUEST = 'host@example.com' // mimo zoznamu správcov, vstup len cez pozvánku

const as = (email: string) => ({ as: email })

async function setup() {
  await send(app, 'GET', api('/me'), undefined, as(OWNER))
  await send(app, 'GET', api('/me'), undefined, as(MEMBER))
}

const list = async (email = OWNER) => {
  const res = await send(app, 'GET', api('/household/members'), undefined, as(email))
  expect(res.status).toBe(200)
  return res.json<HouseholdMemberDto[]>()
}

const invite = (email: string, role?: string, by = OWNER) =>
  send(app, 'POST', api('/household/members'), { email, role }, as(by))

describe('zoznam členov domácnosti', () => {
  it('ukáže členov s rolou, posledným prihlásením a zámkom pre e-maily zo zoznamu správcov', async () => {
    await setup()
    await invite(GUEST)
    const members = await list()
    const byEmail = Object.fromEntries(members.map((m) => [m.email, m]))
    expect(byEmail[OWNER]).toMatchObject({ role: 'owner', locked: true })
    expect(byEmail[MEMBER]).toMatchObject({ role: 'member', locked: true })
    expect(byEmail[GUEST]).toMatchObject({ role: 'member', locked: false, lastLoginAt: null })
    expect(byEmail[OWNER]?.lastLoginAt).not.toBeNull()
  })

  it('zoznam môže čítať aj člen', async () => {
    await setup()
    expect((await list(MEMBER)).length).toBe(2)
  })
})

describe('pozvánky', () => {
  it('vlastník pozve nový e-mail, pozvaný potom vojde a e-mail sa uloží malými písmenami', async () => {
    await setup()
    const res = await invite('Host@Example.com', 'member')
    expect(res.status).toBe(201)
    expect(await res.json<HouseholdMemberDto>()).toMatchObject({ email: 'host@example.com', role: 'member' })

    const me = await send(app, 'GET', api('/me'), undefined, as(GUEST))
    expect(me.status).toBe(200)
    expect((await me.json<MeResponse>()).user.role).toBe('member')
  })

  it('rola sa dá zvoliť a predvolene je člen', async () => {
    await setup()
    expect((await (await invite(GUEST, 'owner')).json<HouseholdMemberDto>()).role).toBe('owner')
    const second = await invite('druhy@example.com')
    expect((await second.json<HouseholdMemberDto>()).role).toBe('member')
  })

  it('duplicita je 409, neplatný e-mail alebo rola 400, člen nesmie pozývať 403', async () => {
    await setup()
    const dup = await invite(MEMBER)
    expect(dup.status).toBe(409)
    expect((await dup.json<ApiErrorBody>()).error.code).toBe('already_member')
    expect((await invite('nie-je-email')).status).toBe(400)
    expect((await invite(GUEST, 'boss')).status).toBe(400)

    const denied = await invite(GUEST, 'member', MEMBER)
    expect(denied.status).toBe(403)
    expect((await denied.json<ApiErrorBody>()).error.code).toBe('owner_required')
  })
})

describe('zmena role a odobratie', () => {
  const idOf = async (email: string) => (await list()).find((m) => m.email === email)!.userId
  const put = (userId: string, role: string, by = OWNER) =>
    send(app, 'PUT', api(`/household/members/${userId}`), { role }, as(by))
  const del = (userId: string, by = OWNER) =>
    send(app, 'DELETE', api(`/household/members/${userId}`), undefined, as(by))

  it('povýši člena a potom ho môže degradovať, keď je ďalší vlastník', async () => {
    await setup()
    const memberId = await idOf(MEMBER)
    expect((await put(memberId, 'owner')).status).toBe(200)
    expect((await list()).find((m) => m.email === MEMBER)?.role).toBe('owner')
    expect((await put(await idOf(OWNER), 'member')).status).toBe(200)
    expect((await list()).filter((m) => m.role === 'owner').map((m) => m.email)).toEqual([MEMBER])
  })

  it('posledného vlastníka sa nedá degradovať ani odobrať', async () => {
    await setup()
    const ownerId = await idOf(OWNER)
    const demote = await put(ownerId, 'member')
    expect(demote.status).toBe(409)
    expect((await demote.json<ApiErrorBody>()).error.code).toBe('last_owner')

    await invite(GUEST)
    const guestId = await idOf(GUEST)
    // s dvoma vlastníkmi sa jeden (hosť, bez zámku) odobrať dá a ostane jeden
    await put(guestId, 'owner')
    await send(app, 'DELETE', api(`/household/members/${guestId}`), undefined, as(OWNER))
    const members = await list()
    expect(members.filter((m) => m.role === 'owner')).toHaveLength(1)
  })

  it('odobratie pozvaného zruší prístup, e-mail zo zoznamu správcov sa odobrať nedá', async () => {
    await setup()
    await invite(GUEST)
    expect((await del(await idOf(GUEST))).status).toBe(204)
    expect((await send(app, 'GET', api('/me'), undefined, as(GUEST))).status).toBe(403)

    const locked = await del(await idOf(MEMBER))
    expect(locked.status).toBe(409)
    expect((await locked.json<ApiErrorBody>()).error.code).toBe('locked')
  })

  it('posledný vlastník pozvaný mimo zoznamu správcov sa tiež neodoberie', async () => {
    await setup()
    await invite(GUEST, 'owner')
    await put(await idOf(OWNER), 'member')
    const guestId = await idOf(GUEST)
    const res = await del(guestId)
    // vlastník GUEST už je jediný vlastník; volá ho ale ja@, ktorý je teraz člen
    expect(res.status).toBe(403)
    expect((await del(guestId, GUEST)).status).toBe(409)
  })

  it('člen nič nemení; neznáme ID je 404; cudzia domácnosť je nedotknutá', async () => {
    await setup()
    await invite(GUEST)
    const guestId = await idOf(GUEST)
    expect((await put(guestId, 'owner', MEMBER)).status).toBe(403)
    expect((await del(guestId, MEMBER)).status).toBe(403)
    expect((await put('neexistuje', 'owner')).status).toBe(404)
    expect((await del('neexistuje')).status).toBe(404)

    const other = await createHousehold(getDb(env), 'Rodičia')
    const foreign = await inviteMember(getDb(env), other, 'cudzi@example.com', 'owner')
    expect((await put(foreign.id, 'member')).status).toBe(404)
    expect((await del(foreign.id)).status).toBe(404)
    expect(await count('household_members')).toBe(4)
  })
})

describe('domácnosť', () => {
  it('vlastník ju premenuje, člen nie', async () => {
    await setup()
    const denied = await send(app, 'PUT', api('/household'), { name: 'Nový názov' }, as(MEMBER))
    expect(denied.status).toBe(403)
    const ok = await send(app, 'PUT', api('/household'), { name: '  Naši  ' }, as(OWNER))
    expect(ok.status).toBe(200)
    const me = await (await send(app, 'GET', api('/me'), undefined, as(OWNER))).json<MeResponse>()
    expect(me.household.name).toBe('Naši')
    expect((await send(app, 'PUT', api('/household'), { name: ' ' }, as(OWNER))).status).toBe(400)
  })

  it('správca (zo zoznamu) založí ďalšiu domácnosť a je jej vlastníkom', async () => {
    await setup()
    const res = await send(app, 'POST', api('/households'), { name: 'Rodičia' }, as(OWNER))
    expect(res.status).toBe(201)
    const created = await res.json<HouseholdSummaryDto>()
    expect(created).toMatchObject({ name: 'Rodičia', role: 'owner' })

    const households = await (
      await send(app, 'GET', api('/households'), undefined, as(OWNER))
    ).json<HouseholdSummaryDto[]>()
    expect(households.map((h) => h.name).sort()).toEqual(['Naša domácnosť', 'Rodičia'])

    // nová domácnosť má vlastné sloty, nákupný zoznam a nastavenia
    const me = await (
      await send(app, 'GET', api(`/me?h=${created.id}`), undefined, as(OWNER))
    ).json<MeResponse>()
    expect(me.slots).toHaveLength(5)
    expect(me.settings.weekStartsOn).toBe(1)
    const lists = await (
      await send(app, 'GET', api(`/shopping/lists?h=${created.id}`), undefined, as(OWNER))
    ).json<unknown[]>()
    expect(lists).toHaveLength(1)
  })

  it('pozvaný mimo zoznamu správcov novú domácnosť nezaloží', async () => {
    await setup()
    await invite(GUEST, 'owner')
    const res = await send(app, 'POST', api('/households'), { name: 'Moja' }, as(GUEST))
    expect(res.status).toBe(403)
    expect((await res.json<ApiErrorBody>()).error.code).toBe('admin_required')
  })

  it('správca bez zvolenej domácnosti môže zakladať, aj keď ich má viac', async () => {
    await setup()
    const owner = await ensureUser(getDb(env), OWNER)
    await addMembership(getDb(env), owner.id, await createHousehold(getDb(env), 'Druhá'), 'owner')
    const res = await send(app, 'POST', api('/households'), { name: 'Tretia' }, as(OWNER))
    expect(res.status).toBe(201)
  })
})
