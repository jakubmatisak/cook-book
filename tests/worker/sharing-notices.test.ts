import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { ContactDto, HouseholdAccountDto, RecipeDetailDto, ShareNoticeDto } from '@shared/api'
import { api, send } from './helpers'
import { A, app, as, B, C, createRecipe, setupHouseholds, share } from './sharingHelpers'

const notices = async (by = B) =>
  (await send(app, 'GET', api('/sharing/notices'), undefined, as(by))).json<ShareNoticeDto[]>()
const incomingIds = async (by = B) =>
  (await (await send(app, 'GET', api('/sharing/incoming'), undefined, as(by))).json<{ id: string }[]>()).map(
    (s) => s.id,
  )

async function acceptAll(by = B) {
  for (const id of await incomingIds(by))
    await send(app, 'POST', api(`/sharing/${id}/accept`), undefined, as(by))
}

const update = (id: string, title: string) =>
  send(app, 'PUT', api(`/recipes/${id}`), {
    title,
    servings: 4,
    category: 'hlavne',
    ingredients: [{ name: 'Múka', quantity: 300, unit: 'g' }],
    steps: [{ text: 'Uvar.' }],
  })

describe('upozornenia zdieľania', () => {
  it('nová ponuka je upozornenie s počtom receptov a správou', async () => {
    await setupHouseholds()
    const r1 = await createRecipe(A, 'Bábovka')
    const r2 = await createRecipe(A, 'Guláš')
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [r1.id, r2.id], message: 'Ochutnaj' })
    expect(await notices()).toMatchObject([{ kind: 'offer', fromName: 'ja', count: 2, message: 'Ochutnaj' }])
    expect(await notices(C)).toEqual([])
  })

  it('v prijatom tagu pribudnuté recepty sú upozornenie, po pozretí zmizne', async () => {
    await setupHouseholds()
    const first = await createRecipe(A, 'Bábovka', { tags: ['Vianoce'] })
    await share(A, { emails: [B], kind: 'tag', tagId: first.tags[0]!.id })
    await acceptAll()
    expect(await notices()).toEqual([])
    await env.DB.prepare('update recipe_shares set seen_at = ?').bind('2000-01-01T00:00:00.000Z').run()
    await env.DB.prepare('update recipes set created_at = ?').bind('1999-01-01T00:00:00.000Z').run()
    await createRecipe(A, 'Medovník', { tags: ['Vianoce'] })
    const [notice] = await notices()
    expect(notice).toMatchObject({ kind: 'new', label: 'Vianoce', count: 1, fromName: 'ja' })
    await send(app, 'POST', api(`/sharing/${(notice as { shareId: string }).shareId}/seen`), undefined, as(B))
    expect(await notices()).toEqual([])
  })

  it('zmenený originál kópie je upozornenie; skrytie aj náhrada kópie ho vybavia', async () => {
    await setupHouseholds()
    const original = await createRecipe(A, 'Bábovka')
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [original.id] })
    await acceptAll()
    const copy = await (
      await send(app, 'POST', api(`/public/recipes/${original.id}/copy`), undefined, as(B))
    ).json<RecipeDetailDto>()
    expect(await notices()).toEqual([])

    await env.DB.prepare('update recipes set copied_source_updated_at = ? where id = ?')
      .bind('2000-01-01T00:00:00.000Z', copy.id)
      .run()
    await update(original.id, 'Bábovka mramorová')
    expect(await notices()).toMatchObject([
      { kind: 'changed', recipeId: copy.id, title: 'Bábovka', fromName: 'ja', sourceId: original.id },
    ])

    expect(
      (await send(app, 'POST', api('/sharing/notices/dismiss'), { recipeId: copy.id }, as(B))).status,
    ).toBe(200)
    expect(await notices()).toEqual([])

    await env.DB.prepare('update recipes set copied_source_updated_at = ? where id = ?')
      .bind('2000-01-01T00:00:00.000Z', copy.id)
      .run()
    const replaced = await send(app, 'POST', api(`/recipes/${copy.id}/replace-from-source`), undefined, as(B))
    expect(replaced.status).toBe(200)
    expect((await replaced.json<RecipeDetailDto>()).title).toBe('Bábovka mramorová')
    expect(await notices()).toEqual([])
  })

  it('kópiu nezdieľaného originálu nahradiť nejde', async () => {
    await setupHouseholds()
    const original = await createRecipe(A, 'Bábovka')
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [original.id] })
    await acceptAll()
    const copy = await (
      await send(app, 'POST', api(`/public/recipes/${original.id}/copy`), undefined, as(B))
    ).json<RecipeDetailDto>()
    await env.DB.prepare(`update recipe_shares set status = 'revoked'`).run()
    expect(
      (await send(app, 'POST', api(`/recipes/${copy.id}/replace-from-source`), undefined, as(B))).status,
    ).toBe(404)
  })
})

describe('kontakty', () => {
  it('sa dajú vypísať, premenovať a zmazať; cudzie nie', async () => {
    await setupHouseholds()
    const r1 = await createRecipe(A, 'Bábovka')
    await share(A, { emails: [B, 'mama@example.com'], kind: 'recipes', recipeIds: [r1.id] })
    const list = async (by = A) =>
      (await send(app, 'GET', api('/contacts'), undefined, as(by))).json<ContactDto[]>()
    const contacts = await list()
    expect(contacts.map((c) => c.email)).toEqual(['mama@example.com', B])
    expect(await list(B)).toEqual([])

    const svokra = contacts.find((c) => c.email === B)!
    expect((await send(app, 'PATCH', api(`/contacts/${svokra.id}`), { name: 'Svokra' }, as(C))).status).toBe(
      404,
    )
    expect((await send(app, 'PATCH', api(`/contacts/${svokra.id}`), { name: 'Svokra' })).status).toBe(200)
    expect((await list()).find((c) => c.email === B)?.name).toBe('Svokra')
    expect((await send(app, 'DELETE', api(`/contacts/${svokra.id}`))).status).toBe(204)
    expect((await list()).map((c) => c.email)).toEqual(['mama@example.com'])
  })
})

describe('nováčik bez domácnosti', () => {
  it('na obrazovke zakladania domácnosti vidí počet čakajúcich ponúk', async () => {
    await setupHouseholds()
    const r1 = await createRecipe(A, 'Bábovka')
    await share(A, { emails: ['novacik@example.com'], kind: 'recipes', recipeIds: [r1.id] })
    const account = await (
      await send(app, 'GET', api('/households/account'), undefined, as('novacik@example.com'))
    ).json<HouseholdAccountDto>()
    expect(account.pendingShares).toBe(1)
  })
})
