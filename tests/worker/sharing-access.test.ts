import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { BulkAffectedDto, ImageDto, PublicRecipeDetailDto, RecipeDetailDto } from '@shared/api'
import { api, LOCAL, send } from './helpers'
import { A, app, as, B, C, createRecipe, setupHouseholds, share } from './sharingHelpers'

const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 9, 9])

/** Kým nie je API prijatia, stav ponuky sa nastaví priamo v databáze. */
const setStatus = (status: string, householdId: string | null, email = B) =>
  env.DB.prepare('update recipe_shares set status = ?, to_household_id = ? where to_email = ?')
    .bind(status, householdId, email)
    .run()

const read = (id: string, by = B) => send(app, 'GET', api(`/public/recipes/${id}`), undefined, as(by))

describe('prístup k zdieľaným receptom', () => {
  it('čakajúca, odmietnutá a zrušená ponuka recept neukáže; prijatá áno, aj s tým, od koho je', async () => {
    const { bId } = await setupHouseholds()
    const r = await createRecipe(A, 'Bábovka')
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [r.id] })
    expect((await read(r.id)).status).toBe(404)

    await setStatus('accepted', bId)
    const res = await read(r.id)
    expect(res.status).toBe(200)
    const detail = await res.json<PublicRecipeDetailDto>()
    expect(detail.title).toBe('Bábovka')
    expect(detail.sharedFrom).toBe('ja')
    expect(detail.ownedByMe).toBe(false)
    // Cudzia domácnosť C recept nevidí.
    expect((await read(r.id, C)).status).toBe(404)

    for (const status of ['declined', 'revoked']) {
      await setStatus(status, bId)
      expect((await read(r.id)).status).toBe(404)
    }
  })

  it('zmazaný recept zo zdieľania zmizne', async () => {
    const { bId } = await setupHouseholds()
    const r = await createRecipe(A, 'Bábovka')
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [r.id] })
    await setStatus('accepted', bId)
    expect((await send(app, 'DELETE', api(`/recipes/${r.id}`))).status).toBe(204)
    expect((await read(r.id)).status).toBe(404)
  })

  it('zdieľaná kategória zahŕňa aj recepty pridané neskôr, aj cez „hodí sa aj ako“', async () => {
    const { bId } = await setupHouseholds()
    await share(A, { emails: [B], kind: 'category', category: 'dezert' })
    await setStatus('accepted', bId)
    const later = await createRecipe(A, 'Koláč', { category: 'dezert' })
    const other = await createRecipe(A, 'Guláš', { category: 'hlavne' })
    expect((await read(later.id)).status).toBe(200)
    expect((await read(other.id)).status).toBe(404)
    await send(app, 'POST', api('/recipes/bulk/update'), { ids: [other.id], addCategories: ['dezert'] })
    expect((await read(other.id)).status).toBe(200)
  })

  it('zdieľaný tag ukáže len recepty s tagom', async () => {
    const { bId } = await setupHouseholds()
    const tagged = await createRecipe(A, 'Bábovka', { tags: ['Vianoce'] })
    const plain = await createRecipe(A, 'Guláš')
    await share(A, { emails: [B], kind: 'tag', tagId: tagged.tags[0]!.id })
    await setStatus('accepted', bId)
    expect((await read(tagged.id)).status).toBe(200)
    expect((await read(plain.id)).status).toBe(404)
  })

  it('obal zdieľaného receptu sa zobrazí až po prijatí', async () => {
    const { bId } = await setupHouseholds()
    const data = new FormData()
    data.append('file', new File([WEBP], 'fotka', { type: 'image/webp' }))
    data.append('width', '800')
    data.append('height', '600')
    const image = await (await send(app, 'POST', api('/images'), data)).json<ImageDto>()
    const r = await createRecipe(A, 'Bábovka')
    await send(app, 'PUT', api(`/recipes/${r.id}`), {
      title: r.title,
      servings: 4,
      category: 'hlavne',
      coverImageId: image.id,
      ingredients: [{ name: 'Múka', quantity: 300, unit: 'g' }],
      steps: [{ text: 'Uvar.' }],
    })
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [r.id] })
    const cover = () => send(app, 'GET', `${LOCAL}${image.url}`, undefined, as(B))
    expect((await cover()).status).toBe(404)
    await setStatus('accepted', bId)
    expect((await cover()).status).toBe(200)
  })

  it('kópia zdieľaného receptu si pamätá, od koho je', async () => {
    const { bId } = await setupHouseholds()
    const r = await createRecipe(A, 'Bábovka')
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [r.id] })
    await setStatus('accepted', bId)
    const res = await send(app, 'POST', api(`/public/recipes/${r.id}/copy`), undefined, as(B))
    expect(res.status).toBe(201)
    const copy = await res.json<RecipeDetailDto>()
    expect(copy.copiedFrom).toBe('ja')
    const row = await env.DB.prepare(
      'select parent_recipe_id, copied_source_updated_at from recipes where id = ?',
    )
      .bind(copy.id)
      .first<{ parent_recipe_id: string; copied_source_updated_at: string }>()
    expect(row).toEqual({ parent_recipe_id: r.id, copied_source_updated_at: r.updatedAt })
  })

  it('príjemca zdieľaný recept nezmení', async () => {
    const { bId } = await setupHouseholds()
    const r = await createRecipe(A, 'Bábovka')
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [r.id] })
    await setStatus('accepted', bId)
    const put = await send(
      app,
      'PUT',
      api(`/recipes/${r.id}`),
      { title: 'Prepísané', servings: 4, category: 'hlavne', ingredients: [], steps: [] },
      as(B),
    )
    expect(put.status).toBe(404)
    const bulk = await send(app, 'POST', api('/recipes/bulk/update'), { ids: [r.id], favorite: true }, as(B))
    expect((await bulk.json<BulkAffectedDto>()).affected).toBe(0)
    expect((await read(r.id)).status).toBe(200)
    expect((await (await read(r.id)).json<PublicRecipeDetailDto>()).title).toBe('Bábovka')
  })
})
