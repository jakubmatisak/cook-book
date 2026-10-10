import { describe, expect, it } from 'vitest'
import type {
  IncomingShareDto,
  PublicRecipeDetailDto,
  RecipeDetailDto,
  RecipeListDto,
  ShareNoticeDto,
} from '@shared/api'
import { api, send } from './helpers'
import { A, app, as, B, C, createRecipe, setupHouseholds, share } from './sharingHelpers'

const incoming = async () =>
  (await send(app, 'GET', api('/sharing/incoming'), undefined, as(B))).json<IncomingShareDto[]>()
const notices = async () =>
  (await send(app, 'GET', api('/sharing/notices'), undefined, as(B))).json<ShareNoticeDto[]>()
async function acceptAll() {
  for (const o of await incoming()) {
    if (o.status === 'pending') await send(app, 'POST', api(`/sharing/${o.id}/accept`), undefined, as(B))
  }
}
const recipeBody = (title: string, tags: string[] = []) => ({
  title,
  servings: 4,
  category: 'hlavne',
  ingredients: [{ name: 'Múka', quantity: 300, unit: 'g' }],
  steps: [{ text: 'Uvar.' }],
  tags,
})

describe('opravy po revízii zdieľania', () => {
  it('v prijatom tagu sa ako nový ráta aj starší recept, ktorý odosielateľ otagoval neskôr', async () => {
    await setupHouseholds()
    const tagged = await createRecipe(A, 'Bábovka', { tags: ['Vianoce'] })
    const older = await createRecipe(A, 'Medovník')
    await share(A, { emails: [B], kind: 'tag', tagId: tagged.tags[0]!.id })
    await acceptAll()
    expect((await incoming())[0]).toMatchObject({ newCount: 0 })

    await send(app, 'POST', api('/recipes/bulk/update'), { ids: [older.id], addTags: ['Vianoce'] })
    expect((await incoming())[0]).toMatchObject({ newCount: 1 })
    expect(await notices()).toMatchObject([{ kind: 'new', count: 1 }])

    await send(app, 'POST', api(`/sharing/${(await incoming())[0]!.id}/seen`), undefined, as(B))
    expect((await incoming())[0]).toMatchObject({ newCount: 0 })
  })

  it('označenie originálu ako overeného ani odkaz na zdieľanie nevyvolá upozornenie o zmene; úprava obsahu áno', async () => {
    await setupHouseholds()
    const original = await createRecipe(A, 'Bábovka')
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [original.id] })
    await acceptAll()
    await send(app, 'POST', api(`/public/recipes/${original.id}/copy`), undefined, as(B))

    await send(app, 'PUT', api(`/recipes/${original.id}/verified`), { verified: true })
    await send(app, 'POST', api(`/recipes/${original.id}/share`))
    expect(await notices()).toEqual([])

    await send(app, 'PUT', api(`/recipes/${original.id}`), recipeBody('Bábovka mramorová'))
    expect(await notices()).toMatchObject([{ kind: 'changed' }])
  })

  it('filter Zdieľam neukáže cudzie verejné recepty ani pri zapnutých receptoch od iných', async () => {
    await setupHouseholds()
    const mine = await createRecipe(A, 'Bábovka')
    await createRecipe(A, 'Nezdieľaný guláš')
    const foreign = await createRecipe(C, 'Cudzí verejný koláč')
    await send(app, 'PUT', api(`/recipes/${foreign.id}/visibility`), { visibility: 'public' }, as(C))
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [mine.id] })
    const list = await (
      await send(app, 'GET', api('/recipes?public=include&sharedByMe=1'))
    ).json<RecipeListDto>()
    expect(list.items.map((r) => r.title)).toEqual(['Bábovka'])
  })

  it('detail cudzieho receptu povie, či už mám jeho kópiu (pridanie do plánu ju použije znova)', async () => {
    await setupHouseholds()
    const original = await createRecipe(A, 'Bábovka')
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [original.id] })
    await acceptAll()
    const read = async () =>
      (
        await send(app, 'GET', api(`/public/recipes/${original.id}`), undefined, as(B))
      ).json<PublicRecipeDetailDto>()
    expect((await read()).myCopyId).toBeNull()
    const copy = await (
      await send(app, 'POST', api(`/public/recipes/${original.id}/copy`), undefined, as(B))
    ).json<RecipeDetailDto>()
    expect((await read()).myCopyId).toBe(copy.id)
  })
})
