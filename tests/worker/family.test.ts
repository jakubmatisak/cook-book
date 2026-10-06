import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { FamilyMemberDto, MealSlotDto, MeResponse } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

const me = async () => (await send(app, 'GET', api('/me'))).json<MeResponse>()

async function addMember(body: object) {
  const res = await send(app, 'POST', api('/members'), body)
  expect(res.status).toBe(201)
  return res.json<FamilyMemberDto>()
}

describe('členovia rodiny', () => {
  it('pridá dospelého a dieťa s predvolenými porciami', async () => {
    const mama = await addMember({ name: 'Mama', kind: 'adult' })
    const ema = await addMember({ name: 'Ema', kind: 'child' })
    expect(mama).toMatchObject({ name: 'Mama', kind: 'adult', portionFactor: 1, isActive: true })
    expect(ema).toMatchObject({ name: 'Ema', kind: 'child', portionFactor: 0.5 })

    const list = await (await send(app, 'GET', api('/members'))).json<FamilyMemberDto[]>()
    expect(list.map((m) => m.name)).toEqual(['Mama', 'Ema'])
    expect((await me()).members.map((m) => m.name)).toEqual(['Mama', 'Ema'])
  })

  it('dieťa dostane koeficient z nastavení domácnosti', async () => {
    await send(app, 'PUT', api('/settings'), { childPortionFactor: 0.75 })
    const ema = await addMember({ name: 'Ema', kind: 'child' })
    expect(ema.portionFactor).toBe(0.75)
  })

  it('upraví a zmaže člena', async () => {
    const ema = await addMember({ name: 'Ema', kind: 'child' })
    const res = await send(app, 'PUT', api(`/members/${ema.id}`), {
      name: 'Emka',
      kind: 'child',
      portionFactor: 0.6,
      isActive: false,
      color: '#5F7A3A',
    })
    expect(res.status).toBe(200)
    expect(await res.json<FamilyMemberDto>()).toMatchObject({
      name: 'Emka',
      portionFactor: 0.6,
      isActive: false,
      color: '#5F7A3A',
    })
    expect((await send(app, 'DELETE', api(`/members/${ema.id}`))).status).toBe(204)
    expect((await me()).members).toEqual([])
  })

  it('člen inej domácnosti je 404', async () => {
    await me()
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into family_members (id, household_id, name, kind, portion_factor, is_active, sort_order, created_at, updated_at) values ('m-iny', 'iny', 'Cudzí', 'adult', 1, 1, 0, 'x', 'x')",
      ),
    ])
    expect((await send(app, 'PUT', api('/members/m-iny'), { name: 'X', kind: 'adult' })).status).toBe(404)
    expect((await send(app, 'DELETE', api('/members/m-iny'))).status).toBe(404)
    expect((await send(app, 'GET', api('/members'))).status).toBe(200)
    expect(await (await send(app, 'GET', api('/members'))).json()).toEqual([])
  })

  it('neplatný vstup je 400', async () => {
    expect((await send(app, 'POST', api('/members'), { name: '', kind: 'adult' })).status).toBe(400)
    expect((await send(app, 'POST', api('/members'), { name: 'X', kind: 'pes' })).status).toBe(400)
  })
})

describe('jedlá dňa', () => {
  it('premenuje a vypne slot', async () => {
    const slot = (await me()).slots.find((s) => s.name === 'Desiata')!
    const res = await send(app, 'PUT', api(`/slots/${slot.id}`), {
      isEnabled: false,
      name: 'Desiata do školy',
    })
    expect(res.status).toBe(200)
    expect(await res.json<MealSlotDto>()).toMatchObject({ isEnabled: false, name: 'Desiata do školy' })
    expect((await me()).slots.find((s) => s.id === slot.id)?.isEnabled).toBe(false)
  })

  it('slot inej domácnosti je 404, neznáme pole 400', async () => {
    const slot = (await me()).slots[0]!
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into meal_slots (id, household_id, name, sort_order, is_enabled, created_at, updated_at) values ('s-iny', 'iny', 'Cudzí', 0, 1, 'x', 'x')",
      ),
    ])
    expect((await send(app, 'PUT', api('/slots/s-iny'), { isEnabled: false })).status).toBe(404)
    expect((await send(app, 'PUT', api(`/slots/${slot.id}`), { farba: 'x' })).status).toBe(400)
  })
})

describe('nastavenia', () => {
  it('zmení začiatok týždňa a ostatné ponechá', async () => {
    const res = await send(app, 'PUT', api('/settings'), { weekStartsOn: 0 })
    expect(res.status).toBe(200)
    expect((await me()).settings).toEqual({
      weekStartsOn: 0,
      childPortionFactor: 0.5,
      starterIngredientsAdded: false,
    })
  })

  it('/me doplní predvolené nastavenia, aj keď v databáze chýbajú', async () => {
    await me()
    await env.DB.prepare('delete from settings').run()
    expect((await me()).settings).toEqual({
      weekStartsOn: 1,
      childPortionFactor: 0.5,
      starterIngredientsAdded: false,
    })
  })

  it('neznámy kľúč alebo zlá hodnota je 400', async () => {
    expect((await send(app, 'PUT', api('/settings'), { weekStartsOn: 3 })).status).toBe(400)
    expect((await send(app, 'PUT', api('/settings'), { tema: 'tmava' })).status).toBe(400)
  })
})

describe('jedlá dňa – duplicitný názov', () => {
  it('premenovanie na existujúci názov je 409, nie 500', async () => {
    const slots = (await me()).slots
    const res = await send(app, 'PUT', api(`/slots/${slots[0]!.id}`), { name: slots[1]!.name })
    expect(res.status).toBe(409)
  })
})
