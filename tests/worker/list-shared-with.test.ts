import { describe, expect, it } from 'vitest'
import type { RecipeListDto } from '@shared/api'
import { env } from 'cloudflare:workers'
import { api, send } from './helpers'
import { A, app, as, B, createRecipe, setupHouseholds, share } from './sharingHelpers'

const list = async (query = '') =>
  (await send(app, 'GET', api(`/recipes${query}`), undefined, as(A))).json<RecipeListDto>()

describe('zoznam receptov: komu zdieľam a zverejnené', () => {
  it('súhrn vlastného receptu nesie, komu je zdieľaný (meno kontaktu alebo e-mail)', async () => {
    await setupHouseholds()
    const r1 = await createRecipe(A, 'Bábovka')
    await createRecipe(A, 'Guláš')
    const dessert = await createRecipe(A, 'Koláč', { category: 'dezert' })
    await share(A, { emails: [B, 'mama@example.com'], kind: 'recipes', recipeIds: [r1.id] })
    await share(A, { emails: ['teta@example.com'], kind: 'category', category: 'dezert' })
    await env.DB.prepare('update contacts set name = ? where email = ?').bind('Svokra', B).run()
    const items = (await list()).items
    const byTitle = Object.fromEntries(items.map((r) => [r.title, r.sharedWith]))
    expect(byTitle['Bábovka']).toEqual(['mama@example.com', 'Svokra'])
    expect(byTitle['Koláč']).toEqual(['teta@example.com'])
    expect(byTitle['Guláš']).toBeUndefined()
    expect(dessert.id).toBeTruthy()
  })

  it('filter published=1 ukáže len moje zverejnené recepty', async () => {
    await setupHouseholds()
    const pub = await createRecipe(A, 'Verejná bábovka')
    await createRecipe(A, 'Súkromný guláš')
    await send(app, 'PUT', api(`/recipes/${pub.id}/visibility`), { visibility: 'public' }, as(A))
    const foreign = await createRecipe(B, 'Cudzí verejný')
    await send(app, 'PUT', api(`/recipes/${foreign.id}/visibility`), { visibility: 'public' }, as(B))
    expect((await list('?published=1&public=include')).items.map((r) => r.title)).toEqual(['Verejná bábovka'])
  })
})
