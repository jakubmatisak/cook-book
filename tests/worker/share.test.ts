import { describe, expect, it } from 'vitest'
import type { ImageDto, RecipeDetailDto, RecipeShareDto, SharedRecipeDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, call, PROD, send } from './helpers'

const app = createApp()

const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 9, 9])

async function recipeWithCover(): Promise<RecipeDetailDto> {
  const data = new FormData()
  data.append('file', new File([WEBP_BYTES], 'fotka', { type: 'image/webp' }))
  const image = await (await send(app, 'POST', api('/images'), data)).json<ImageDto>()
  const res = await send(app, 'POST', api('/recipes'), {
    title: 'Kôprová omáčka',
    servings: 4,
    coverImageId: image.id,
    tags: ['Rodinné'],
    ingredients: [{ name: 'Kôpor', quantity: 4, unit: 'PL', isOptional: false }],
    steps: [{ text: 'Uvar.' }],
  })
  return res.json<RecipeDetailDto>()
}

const share = async (id: string) =>
  (await send(app, 'POST', api(`/recipes/${id}/share`))).json<RecipeShareDto>()
/** Bez prihlásenia – tak, ako odkaz otvorí ktokoľvek. */
const anonymous = (path: string) => call(app, `${PROD}/api/v1${path}`)

describe('zdieľanie receptu odkazom', () => {
  it('vytvorí neuhádnuteľný odkaz; opakované zdieľanie vráti ten istý a detail ho ukazuje', async () => {
    const recipe = await recipeWithCover()
    const first = await share(recipe.id)
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{22,}$/)
    expect(first.url).toBe(`/s/${first.token}`)
    expect((await share(recipe.id)).token).toBe(first.token)

    const detail = await (await send(app, 'GET', api(`/recipes/${recipe.id}`))).json<RecipeDetailDto>()
    expect(detail.shareToken).toBe(first.token)
  })

  it('recept cez odkaz vidí aj neprihlásený, bez údajov domácnosti; fotka sa načíta tiež', async () => {
    const recipe = await recipeWithCover()
    const { token } = await share(recipe.id)

    const res = await anonymous(`/shared/${token}`)
    expect(res.status).toBe(200)
    const shared = await res.json<SharedRecipeDto>()
    expect(shared).toMatchObject({ title: 'Kôprová omáčka', servings: 4 })
    expect(shared.ingredients.map((i) => i.name)).toEqual(['Kôpor'])
    expect(shared.steps.map((s) => s.text)).toEqual(['Uvar.'])
    expect(shared).not.toHaveProperty('tags')
    expect(shared).not.toHaveProperty('isFavorite')
    expect(shared.coverImageUrl).toBe(`/api/v1/shared/${token}/cover`)

    const cover = await anonymous(`/shared/${token}/cover`)
    expect(cover.status).toBe(200)
    expect(cover.headers.get('content-type')).toBe('image/webp')
    expect(new Uint8Array(await cover.arrayBuffer())).toEqual(WEBP_BYTES)
  })

  it('po zastavení zdieľania odkaz nefunguje a nové zdieľanie dá nový odkaz', async () => {
    const recipe = await recipeWithCover()
    const { token } = await share(recipe.id)
    expect((await send(app, 'DELETE', api(`/recipes/${recipe.id}/share`))).status).toBe(204)

    expect((await anonymous(`/shared/${token}`)).status).toBe(404)
    expect((await anonymous(`/shared/${token}/cover`)).status).toBe(404)
    const detail = await (await send(app, 'GET', api(`/recipes/${recipe.id}`))).json<RecipeDetailDto>()
    expect(detail.shareToken).toBeNull()
    expect((await share(recipe.id)).token).not.toBe(token)
  })

  it('zmazaný recept a neznámy odkaz sú 404; ostatné API bez prihlásenia ostáva zamknuté', async () => {
    const recipe = await recipeWithCover()
    const { token } = await share(recipe.id)
    await send(app, 'DELETE', api(`/recipes/${recipe.id}`))

    expect((await anonymous(`/shared/${token}`)).status).toBe(404)
    expect((await anonymous('/shared/neexistuje-neexistuje-xx')).status).toBe(404)
    expect((await anonymous('/recipes')).status).toBe(401)
  })
})
