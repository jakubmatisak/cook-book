import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, MeResponse } from '@shared/api'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { createHousehold, ensureUser } from '../../worker/services/household'
import { addMembership } from '../../worker/services/memberships'
import { api, send } from './helpers'

const app = createApp()
const ME = 'ja@example.com'
const OTHER = 'manzelka@example.com'

const me = async (as = ME, h?: string) =>
  (await (await send(app, 'GET', api(`/me${h ? `?h=${h}` : ''}`), undefined, { as })).json()) as MeResponse
const put = (body: unknown, as = ME, h?: string) =>
  send(app, 'PUT', api(`/me/settings${h ? `?h=${h}` : ''}`), body, { as })

describe('nastavenia používateľa', () => {
  it('nový používateľ nemá žiadne uložené nastavenia', async () => {
    expect((await me()).userSettings).toEqual({})
  })

  it('uloží jazyk, vzhľad, pohľad zoznamu a predvolené filtre a vráti ich v /me', async () => {
    const res = await put({
      locale: 'en',
      theme: 'dark',
      recipeView: 'table',
      recipeQuery: { kategoria: 'dezert', doma: '1' },
    })
    expect(res.status).toBe(200)
    const expected = {
      locale: 'en',
      theme: 'dark',
      recipeView: 'table',
      recipeQuery: { kategoria: 'dezert', doma: '1' },
    }
    expect(await res.json()).toEqual(expected)
    expect((await me()).userSettings).toEqual(expected)
  })

  it('čiastočná zmena nechá ostatné kľúče a null kľúč vymaže', async () => {
    await put({ locale: 'en', theme: 'dark' })
    await put({ theme: 'light' })
    expect((await me()).userSettings).toEqual({ locale: 'en', theme: 'light' })
    await put({ locale: null })
    expect((await me()).userSettings).toEqual({ theme: 'light' })
  })

  it('každý používateľ má svoje nastavenia', async () => {
    await put({ locale: 'en' })
    await me(OTHER)
    expect((await me(OTHER)).userSettings).toEqual({})
    await put({ theme: 'dark' }, OTHER)
    expect((await me()).userSettings).toEqual({ locale: 'en' })
  })

  it('platia vo všetkých domácnostiach používateľa', async () => {
    const owner = await ensureUser(getDb(env), ME)
    const other = await createHousehold(getDb(env), 'Rodičia')
    await addMembership(getDb(env), owner.id, other, 'member')
    await put({ locale: 'en' }, ME, owner.householdId)
    expect((await me(ME, other)).userSettings).toEqual({ locale: 'en' })
    // aj člen (nie vlastník) si mení vlastné nastavenia
    expect((await put({ theme: 'dark' }, ME, other)).status).toBe(200)
  })

  it('neplatné hodnoty a neznáme kľúče sú 400', async () => {
    for (const body of [
      { locale: 'de' },
      { theme: 'modra' },
      { recipeView: 'kalendar' },
      { recipeQuery: 'doma=1' },
      { recipeQuery: { a: 1 } },
      { neznamy: true },
    ]) {
      const res = await put(body)
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect((await res.json<ApiErrorBody>()).error.code).toBeTruthy()
    }
  })

  it('predvolené filtre majú rozumný limit (počet aj dĺžka)', async () => {
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, 'x']))
    expect((await put({ recipeQuery: many })).status).toBe(400)
    expect((await put({ recipeQuery: { q: 'x'.repeat(300) } })).status).toBe(400)
  })
})
