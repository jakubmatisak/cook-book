import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, FamilyMemberDto, MeResponse } from '@shared/api'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { createHousehold, ensureUser } from '../../worker/services/household'
import { addMembership } from '../../worker/services/memberships'
import { api, send } from './helpers'

const app = createApp()

const OWNER = 'ja@example.com' // prvý prihlásený = vlastník
const MEMBER = 'manzelka@example.com' // ďalší povolený e-mail = člen

async function setup() {
  const owner = await (await send(app, 'GET', api('/me'), undefined, { as: OWNER })).json<MeResponse>()
  const member = await (await send(app, 'GET', api('/me'), undefined, { as: MEMBER })).json<MeResponse>()
  expect(owner.user.role).toBe('owner')
  expect(member.user.role).toBe('member')
  const created = await send(app, 'POST', api('/members'), { name: 'Anna', kind: 'adult' }, { as: OWNER })
  const person = await created.json<FamilyMemberDto>()
  return { slotId: owner.slots[0]!.id, personId: person.id }
}

describe('len vlastník mení domácnosť', () => {
  it('člen dostane 403 owner_required, vlastník prejde', async () => {
    const { slotId, personId } = await setup()
    const calls: [string, string, unknown?][] = [
      ['PUT', '/settings', { weekStartsOn: 0 }],
      ['PUT', `/slots/${slotId}`, { name: 'Brunch' }],
      ['POST', '/members', { name: 'Peter', kind: 'adult' }],
      ['PUT', `/members/${personId}`, { name: 'Anna B.', kind: 'adult' }],
      ['PUT', `/members/${personId}/preferences`, { allergies: [], dislikes: [], diets: [] }],
      ['GET', '/export'],
      ['GET', '/export/recipes.md'],
      ['DELETE', `/members/${personId}`],
    ]
    for (const [method, path, body] of calls) {
      const denied = await send(app, method, api(path), body, { as: MEMBER })
      expect(denied.status, `${method} ${path} ako člen`).toBe(403)
      expect((await denied.json<ApiErrorBody>()).error.code).toBe('owner_required')
    }
    for (const [method, path, body] of calls) {
      const ok = await send(app, method, api(path), body, { as: OWNER })
      expect(ok.status, `${method} ${path} ako vlastník`).toBeLessThan(300)
    }
  })

  it('člen smie čítať rodinu a robiť všetko okolo varenia', async () => {
    await setup()
    expect((await send(app, 'GET', api('/members'), undefined, { as: MEMBER })).status).toBe(200)
    const recipe = await send(app, 'POST', api('/recipes'), { title: 'Guláš', servings: 4 }, { as: MEMBER })
    expect(recipe.status).toBe(201)
    const tag = await send(app, 'POST', api('/tags'), { name: 'rýchle' }, { as: MEMBER })
    expect(tag.status).toBe(201)
    expect(
      (await send(app, 'POST', api('/ingredients/starter'), undefined, { as: MEMBER })).status,
    ).toBeLessThan(300)
  })
})

describe('rola platí pre aktívnu domácnosť', () => {
  it('vlastník v jednej domácnosti je členom v druhej a nemôže tam meniť nastavenia', async () => {
    const owner = await ensureUser(getDb(env), OWNER)
    const other = await createHousehold(getDb(env), 'Rodičia')
    await addMembership(getDb(env), owner.id, other, 'member')

    const mine = await send(
      app,
      'PUT',
      api(`/settings?h=${owner.householdId}`),
      { weekStartsOn: 0 },
      { as: OWNER },
    )
    expect(mine.status).toBe(200)
    const theirs = await send(app, 'PUT', api(`/settings?h=${other}`), { weekStartsOn: 0 }, { as: OWNER })
    expect(theirs.status).toBe(403)
    expect((await theirs.json<ApiErrorBody>()).error.code).toBe('owner_required')
  })
})
