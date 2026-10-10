import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { PublicRecipeDetailDto, RecipeDetailDto, RecipeListDto } from '@shared/api'
import { api, send } from './helpers'
import { A, app, as, B, createRecipe, setupHouseholds, share } from './sharingHelpers'

const list = async (by: string, query = '') =>
  (await send(app, 'GET', api(`/recipes${query}`), undefined, as(by))).json<RecipeListDto>()

async function acceptAll(by = B) {
  const offers = await (
    await send(app, 'GET', api('/sharing/incoming'), undefined, as(by))
  ).json<{ id: string }[]>()
  for (const o of offers) await send(app, 'POST', api(`/sharing/${o.id}/accept`), undefined, as(by))
}

describe('zdieľané recepty v zozname a detaile', () => {
  it('filter „Zdieľané so mnou“ ukáže cudzie zdieľané recepty s tým, od koho sú; bez filtra nie', async () => {
    await setupHouseholds()
    const shared = await createRecipe(A, 'Bábovka')
    await createRecipe(A, 'Tajný guláš')
    await createRecipe(B, 'Svokrin koláč')
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [shared.id] })
    await acceptAll()

    const sharedOnly = await list(B, '?shared=only')
    expect(sharedOnly.items.map((r) => [r.title, r.sharedFrom, r.householdName])).toEqual([
      ['Bábovka', 'ja', 'Naša domácnosť'],
    ])
    expect((await list(B)).items.map((r) => r.title)).toEqual(['Svokrin koláč'])
  })

  it('filter „Zdieľam“ ukáže len moje recepty, ktoré niekomu zdieľam', async () => {
    await setupHouseholds()
    const r1 = await createRecipe(A, 'Bábovka')
    await createRecipe(A, 'Guláš')
    const dessert = await createRecipe(A, 'Koláč', { category: 'dezert' })
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [r1.id] })
    await share(A, { emails: ['mama@example.com'], kind: 'category', category: 'dezert' })
    expect((await list(A, '?sharedByMe=1')).items.map((r) => r.title)).toEqual(['Bábovka', 'Koláč'])
    expect(dessert.id).toBeTruthy()
  })

  it('detail vlastného receptu ukazuje, komu je zdieľaný (meno kontaktu alebo e-mail); cudzím nie', async () => {
    await setupHouseholds()
    const r1 = await createRecipe(A, 'Bábovka')
    await share(A, { emails: [B, 'mama@example.com'], kind: 'recipes', recipeIds: [r1.id] })
    await env.DB.prepare('update contacts set name = ? where email = ?').bind('Svokra', B).run()
    const detail = await (await send(app, 'GET', api(`/recipes/${r1.id}`))).json<RecipeDetailDto>()
    expect(detail.sharedWith).toEqual(['mama@example.com', 'Svokra'])

    await acceptAll()
    const foreign = await (
      await send(app, 'GET', api(`/public/recipes/${r1.id}`), undefined, as(B))
    ).json<PublicRecipeDetailDto>()
    expect(foreign.sharedWith).toBeUndefined()
  })
})
