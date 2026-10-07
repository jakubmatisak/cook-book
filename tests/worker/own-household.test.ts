import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, HouseholdAccountDto, HouseholdSummaryDto, MeResponse } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

const OWNER = 'ja@example.com' // zo zoznamu správcov
const NEWCOMER = 'kolega@example.com' // pustil ho Cloudflare Access, ale nie je v žiadnej domácnosti
const as = (email: string) => ({ as: email })

describe('človek bez domácnosti (pustil ho Cloudflare Access)', () => {
  it('vidí prázdny zoznam domácností a svoj e-mail, ostatné API mu povie, že nemá domácnosť', async () => {
    const households = await send(app, 'GET', api('/households'), undefined, as(NEWCOMER))
    expect(households.status).toBe(200)
    expect(await households.json()).toEqual([])

    const account = await send(app, 'GET', api('/households/account'), undefined, as(NEWCOMER))
    expect(await account.json<HouseholdAccountDto>()).toEqual({ email: NEWCOMER, canCreate: true })

    const me = await send(app, 'GET', api('/me'), undefined, as(NEWCOMER))
    expect(me.status).toBe(403)
    expect((await me.json<ApiErrorBody>()).error.code).toBe('no_household')
  })

  it('založí si vlastnú domácnosť, je jej vlastníkom a nevidí do cudzej', async () => {
    await send(app, 'GET', api('/me'), undefined, as(OWNER))
    const ownerHouseholds = await (
      await send(app, 'GET', api('/households'), undefined, as(OWNER))
    ).json<HouseholdSummaryDto[]>()

    const res = await send(app, 'POST', api('/households'), { name: 'Domácnosť kolegu' }, as(NEWCOMER))
    expect(res.status).toBe(201)
    const created = await res.json<HouseholdSummaryDto>()
    expect(created).toMatchObject({ name: 'Domácnosť kolegu', role: 'owner' })

    const households = await (
      await send(app, 'GET', api('/households'), undefined, as(NEWCOMER))
    ).json<HouseholdSummaryDto[]>()
    expect(households).toEqual([created])

    const me = await (await send(app, 'GET', api('/me'), undefined, as(NEWCOMER))).json<MeResponse>()
    expect(me.household.name).toBe('Domácnosť kolegu')
    expect(me.user.role).toBe('owner')
    expect(me.slots.length).toBeGreaterThan(0)

    const foreign = await send(
      app,
      'GET',
      api(`/recipes?h=${ownerHouseholds[0]!.id}`),
      undefined,
      as(NEWCOMER),
    )
    expect(foreign.status).toBe(403)
  })

  it('kto už domácnosť má, ďalšiu nezaloží (to smie len správca)', async () => {
    await send(app, 'POST', api('/households'), { name: 'Prvá' }, as(NEWCOMER))
    const account = await (
      await send(app, 'GET', api('/households/account'), undefined, as(NEWCOMER))
    ).json<HouseholdAccountDto>()
    expect(account.canCreate).toBe(false)
    const second = await send(app, 'POST', api('/households'), { name: 'Druhá' }, as(NEWCOMER))
    expect(second.status).toBe(403)
    expect((await second.json<ApiErrorBody>()).error.code).toBe('admin_required')
  })

  it('prázdny názov domácnosti je 400', async () => {
    const res = await send(app, 'POST', api('/households'), { name: '  ' }, as(NEWCOMER))
    expect(res.status).toBe(400)
  })
})
