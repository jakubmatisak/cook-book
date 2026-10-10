import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { DEFAULT_HOUSEHOLD_ID, ensureUser } from '../../worker/services/household'
import type { ApiErrorBody, ExportFile, MeResponse } from '@shared/api'
import { call, count, LOCAL } from './helpers'

const app = createApp()

describe('/me', () => {
  it('prvé volania vytvoria jednu domácnosť so seedom, opakované nič neduplikujú', async () => {
    const [a, b] = await Promise.all([call(app, `${LOCAL}/api/v1/me`), call(app, `${LOCAL}/api/v1/me`)])
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    await call(app, `${LOCAL}/api/v1/me`)

    const me = await (await call(app, `${LOCAL}/api/v1/me`)).json<MeResponse>()
    expect(me.household.id).toBe(DEFAULT_HOUSEHOLD_ID)
    expect(me.slots.map((s) => s.name)).toEqual(['Raňajky', 'Desiata', 'Obed', 'Olovrant', 'Večera'])
    expect(me.settings).toMatchObject({ weekStartsOn: 1, childPortionFactor: 0.5 })
    expect(me.members).toEqual([])

    expect(await count('households')).toBe(1)
    expect(await count('users')).toBe(1)
    expect(await count('meal_slots')).toBe(5)
    expect(await count('shop_categories')).toBe(13)
    expect(await count('shopping_lists')).toBe(1)
  })

  it('druhý povolený používateľ sa pridá do tej istej domácnosti', async () => {
    const db = getDb(env)
    const first = await ensureUser(db, 'ja@example.com')
    const second = await ensureUser(db, 'manzelka@example.com')
    expect(second.householdId).toBe(first.householdId)
    expect(second.name).toBe('manzelka')
    expect(await count('households')).toBe(1)
    expect(await count('meal_slots')).toBe(5)
  })
})

describe('/export', () => {
  it('vráti všetky tabuľky domácnosti ako stiahnuteľný JSON', async () => {
    const res = await call(app, `${LOCAL}/api/v1/export`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toMatch(
      /^attachment; filename="kucharska-kniha-\d{4}-\d{2}-\d{2}\.json"$/,
    )
    const body = await res.json<ExportFile>()
    expect(body.format).toBe('kucharska-kniha-export')
    expect(body.version).toBe(1)
    expect(Object.keys(body.tables)).toHaveLength(29)
    expect(body.tables.households).toHaveLength(1)
    expect(body.tables.users).toHaveLength(1)
    expect(body.tables.mealSlots).toHaveLength(5)
    expect(body.tables.shopCategories).toHaveLength(13)
    expect(body.tables.shoppingLists).toHaveLength(1)
    expect(body.tables.settings).toHaveLength(4)
  })

  it('neexportuje dáta inej domácnosti', async () => {
    await call(app, `${LOCAL}/api/v1/me`)
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into meal_slots (id, household_id, name, sort_order, is_enabled, created_at, updated_at) values ('s-iny', 'iny', 'Cudzí slot', 0, 1, 'x', 'x')",
      ),
    ])
    const body = await (await call(app, `${LOCAL}/api/v1/export`)).json<ExportFile>()
    expect(body.tables.households).toHaveLength(1)
    expect(body.tables.mealSlots.map((s) => (s as { name: string }).name)).not.toContain('Cudzí slot')
  })
})

describe('chyby', () => {
  it('neznáma API cesta je JSON 404', async () => {
    const res = await call(app, `${LOCAL}/api/v1/neexistuje`)
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    expect((await res.json<ApiErrorBody>()).error.code).toBe('not_found')
  })
})
