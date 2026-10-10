import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { IncomingShareDto, OutgoingShareDto } from '@shared/api'
import { api, send } from './helpers'
import { A, app, as, B, C, createRecipe, setupHouseholds, share } from './sharingHelpers'

const post = (path: string, by: string, body?: unknown) =>
  send(app, 'POST', api(`/sharing${path}`), body, as(by))
const incoming = async (by = B) =>
  (await send(app, 'GET', api('/sharing/incoming'), undefined, as(by))).json<IncomingShareDto[]>()
const outgoing = async (by = A) =>
  (await send(app, 'GET', api('/sharing/outgoing'), undefined, as(by))).json<OutgoingShareDto[]>()
const read = (id: string, by = B) => send(app, 'GET', api(`/public/recipes/${id}`), undefined, as(by))

async function offerTwo() {
  const r1 = await createRecipe(A, 'Bábovka')
  const r2 = await createRecipe(A, 'Guláš')
  await share(A, { emails: [B], kind: 'recipes', recipeIds: [r1.id, r2.id], message: 'Pre teba' })
  const [offer] = await incoming()
  return { r1, r2, offer: offer! }
}

describe('tok zdieľania', () => {
  it('príjemca vidí čakajúcu ponuku s receptmi, správou a odosielateľom', async () => {
    await setupHouseholds()
    const { offer } = await offerTwo()
    expect(offer).toMatchObject({
      fromName: 'ja',
      kind: 'recipes',
      status: 'pending',
      message: 'Pre teba',
      recipes: [{ title: 'Bábovka' }, { title: 'Guláš' }],
    })
    expect(await incoming(C)).toEqual([])
  })

  it('prijatie len vybraných receptov sprístupní len tie', async () => {
    await setupHouseholds()
    const { r1, r2, offer } = await offerTwo()
    expect((await post(`/${offer.id}/accept`, B, { recipeIds: [r1.id] })).status).toBe(200)
    expect((await read(r1.id)).status).toBe(200)
    expect((await read(r2.id)).status).toBe(404)
    expect(await outgoing()).toMatchObject([{ toEmail: B, status: 'accepted', recipeCount: 1 }])
    expect(await incoming()).toMatchObject([{ status: 'accepted', recipes: [{ title: 'Bábovka' }] }])
  })

  it('cudzí človek ponuku neprijme ani neodmietne', async () => {
    await setupHouseholds()
    const { offer } = await offerTwo()
    expect((await post(`/${offer.id}/accept`, C)).status).toBe(404)
    expect((await post(`/${offer.id}/decline`, C)).status).toBe(404)
    expect((await post(`/${offer.id}/revoke`, B)).status).toBe(404)
  })

  it('odmietnutá ponuka zmizne príjemcovi, odosielateľ vidí stav', async () => {
    await setupHouseholds()
    const { r1, offer } = await offerTwo()
    expect((await post(`/${offer.id}/decline`, B)).status).toBe(200)
    expect(await incoming()).toEqual([])
    expect((await read(r1.id)).status).toBe(404)
    expect(await outgoing()).toMatchObject([{ status: 'declined' }])
  })

  it('zrušenie odosielateľom aj odchod príjemcu vezmú prístup', async () => {
    await setupHouseholds()
    const { r1, offer } = await offerTwo()
    await post(`/${offer.id}/accept`, B)
    expect((await post(`/${offer.id}/revoke`, A)).status).toBe(200)
    expect((await read(r1.id)).status).toBe(404)

    const r3 = await createRecipe(A, 'Rezeň')
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [r3.id] })
    const second = (await incoming()).find((s) => s.status === 'pending')!
    await post(`/${second.id}/accept`, B)
    expect((await read(r3.id)).status).toBe(200)
    expect((await post(`/${second.id}/leave`, B)).status).toBe(200)
    expect((await read(r3.id)).status).toBe(404)
  })

  it('odosielateľ odoberie recept zo zdieľania', async () => {
    await setupHouseholds()
    const { r1, r2, offer } = await offerTwo()
    await post(`/${offer.id}/accept`, B)
    expect((await post(`/${offer.id}/items/remove`, A, { recipeIds: [r2.id] })).status).toBe(200)
    expect((await read(r1.id)).status).toBe(200)
    expect((await read(r2.id)).status).toBe(404)
  })

  it('pri zdieľanom tagu sa rátajú recepty pridané od posledného pozretia', async () => {
    await setupHouseholds()
    const first = await createRecipe(A, 'Bábovka', { tags: ['Vianoce'] })
    await share(A, { emails: [B], kind: 'tag', tagId: first.tags[0]!.id })
    const [offer] = await incoming()
    expect(offer).toMatchObject({ kind: 'tag', tagName: 'Vianoce' })
    await post(`/${offer!.id}/accept`, B)
    // Čas pozretia pred vytvorením nového receptu.
    await env.DB.prepare('update recipe_shares set seen_at = ?').bind('2000-01-01T00:00:00.000Z').run()
    await env.DB.prepare('update recipes set created_at = ?').bind('1999-01-01T00:00:00.000Z').run()
    await createRecipe(A, 'Medovník', { tags: ['Vianoce'] })
    expect((await incoming())[0]).toMatchObject({ newCount: 1 })
    expect((await post(`/${offer!.id}/seen`, B)).status).toBe(200)
    expect((await incoming())[0]).toMatchObject({ newCount: 0 })
  })
})
