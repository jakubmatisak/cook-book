import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, HouseholdMemberDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { createHousehold, ensureUser } from '../../worker/services/household'
import { addMembership, inviteMember } from '../../worker/services/memberships'
import { api, send } from './helpers'

const app = createApp()
const OWNER = 'ja@example.com' // správca (ALLOWED_EMAILS), prvý prihlásený = vlastník
const GUEST = 'host@example.com'
const as = (email: string) => ({ as: email })

const members = async (h?: string) =>
  (await send(app, 'GET', api(`/household/members${h ? `?h=${h}` : ''}`), undefined, as(OWNER))).json<
    HouseholdMemberDto[]
  >()

describe('posledný vlastník pri súbežných zmenách', () => {
  it('dvaja vlastníci sa naraz nedegradujú – jeden vlastník vždy ostane', async () => {
    const owner = await ensureUser(getDb(env), OWNER)
    const guest = await inviteMember(getDb(env), owner.householdId, GUEST, 'owner')
    const put = (userId: string, by: string) =>
      send(app, 'PUT', api(`/household/members/${userId}`), { role: 'member' }, as(by))

    const results = await Promise.all([put(guest.id, OWNER), put(owner.id, GUEST)])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    const owners = (await members()).filter((m) => m.role === 'owner')
    expect(owners).toHaveLength(1)
  })

  it('dvaja vlastníci sa naraz neodoberú – jeden vlastník vždy ostane', async () => {
    const admin = await ensureUser(getDb(env), OWNER)
    const first = await inviteMember(getDb(env), admin.householdId, GUEST, 'owner')
    const second = await inviteMember(getDb(env), admin.householdId, 'treti@example.com', 'owner')
    // správca (ja@) je už len člen, takže vlastníci sú práve dvaja hostia
    await env.DB.prepare("update household_members set role = 'member' where user_id = ?")
      .bind(admin.id)
      .run()

    const del = (userId: string, by: string) =>
      send(app, 'DELETE', api(`/household/members/${userId}`), undefined, as(by))
    const results = await Promise.all([del(second.id, GUEST), del(first.id, 'treti@example.com')])
    expect(results.map((r) => r.status).sort()).toEqual([204, 409])
    expect((await members()).filter((m) => m.role === 'owner')).toHaveLength(1)
  })
})

describe('zámok správcu aplikácie', () => {
  it('správca s ďalšou domácnosťou sa dá z jednej odobrať, zámok platí len pre jeho jedinú domácnosť', async () => {
    const owner = await ensureUser(getDb(env), OWNER)
    const other = await createHousehold(getDb(env), 'Rodičia')
    await addMembership(getDb(env), owner.id, other, 'owner')
    await inviteMember(getDb(env), other, GUEST, 'owner')

    // v domácnosti Rodičia je správca vlastník aj člen viacerých domácností → nie je zamknutý
    const inOther = (await members(other)).find((m) => m.email === OWNER)
    expect(inOther?.locked).toBe(false)
    const removed = await send(
      app,
      'DELETE',
      api(`/household/members/${owner.id}?h=${other}`),
      undefined,
      as(GUEST),
    )
    expect(removed.status).toBe(204)

    // v pôvodnej domácnosti už má jediné členstvo → zamknutý
    const inDefault = (await members(owner.householdId)).find((m) => m.email === OWNER)
    expect(inDefault?.locked).toBe(true)
  })

  it('jediné členstvo správcu sa odobrať nedá', async () => {
    const owner = await ensureUser(getDb(env), OWNER)
    await inviteMember(getDb(env), owner.householdId, GUEST, 'owner')
    const res = await send(app, 'DELETE', api(`/household/members/${owner.id}`), undefined, as(GUEST))
    expect(res.status).toBe(409)
    expect((await res.json<ApiErrorBody>()).error.code).toBe('locked')
  })
})

describe('založenie domácnosti', () => {
  it('s vlastníkom je jeden atomický krok – žiadna domácnosť bez člena', async () => {
    const owner = await ensureUser(getDb(env), OWNER)
    const id = await createHousehold(getDb(env), 'Nová', undefined, owner.id)
    const rows = await env.DB.prepare('select role from household_members where household_id = ?')
      .bind(id)
      .all<{ role: string }>()
    expect(rows.results).toEqual([{ role: 'owner' }])
  })
})

describe('migrácia 0002: doplnenie členstiev pre existujúce účty', () => {
  it('najstarší účet domácnosti je vlastník, ostatní členovia, každá domácnosť zvlášť', async () => {
    const migration = env.TEST_MIGRATIONS.find((m) => m.name.startsWith('0002'))!
    const backfill = migration.queries.find((q) => q.includes('INSERT INTO `household_members`'))!
    expect(backfill).toBeTruthy()

    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('A','A','x','x'), ('B','B','x','x')",
      ),
      env.DB.prepare(
        'insert into users (id, household_id, email, name, created_at, updated_at) values ' +
          "('u2','A','b@x.sk','b','2026-02-01','x'), ('u1','A','a@x.sk','a','2026-01-01','x'), " +
          "('u3','B','c@x.sk','c','2026-03-01','x')",
      ),
      env.DB.prepare('delete from household_members'),
    ])
    await env.DB.prepare(backfill).run()
    const rows = await env.DB.prepare(
      'select user_id, household_id, role from household_members order by user_id',
    ).all<{ user_id: string; household_id: string; role: string }>()
    expect(rows.results).toEqual([
      { user_id: 'u1', household_id: 'A', role: 'owner' },
      { user_id: 'u2', household_id: 'A', role: 'member' },
      { user_id: 'u3', household_id: 'B', role: 'owner' },
    ])
  })
})
