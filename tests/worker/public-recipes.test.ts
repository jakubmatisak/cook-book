import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type {
  ApiErrorBody,
  ImageDto,
  PublicRecipeDetailDto,
  PublicRecipeSummaryDto,
  RecipeDetailDto,
  RecipeListDto,
} from '@shared/api'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { createHousehold, ensureUser } from '../../worker/services/household'
import { inviteMember } from '../../worker/services/memberships'
import { api, send } from './helpers'

const app = createApp()
const A = 'ja@example.com' // vlastník domácnosti A (default)
const B = 'manzelka@example.com' // vlastník domácnosti B (Rodičia)
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 9, 9])
const as = (email: string) => ({ as: email })

async function setup() {
  const a = await ensureUser(getDb(env), A)
  const b = await createHousehold(getDb(env), 'Rodičia')
  await inviteMember(getDb(env), b, B, 'owner')
  return { aId: a.householdId, bId: b }
}

async function uploadImage(by: string) {
  const data = new FormData()
  data.append('file', new File([WEBP], 'fotka', { type: 'image/webp' }))
  data.append('width', '800')
  data.append('height', '600')
  const res = await send(app, 'POST', api('/images'), data, as(by))
  expect(res.status).toBe(201)
  return res.json<ImageDto>()
}

async function createRecipe(by: string, title = 'Grófkin koláč', withImage = false) {
  const image = withImage ? await uploadImage(by) : null
  const res = await send(
    app,
    'POST',
    api('/recipes'),
    {
      title,
      servings: 6,
      category: 'dezert',
      prepMinutes: 20,
      cookMinutes: 40,
      description: 'Jablkový koláč',
      coverImageId: image?.id ?? null,
      ingredients: [
        { name: 'Jablká', quantity: 1, unit: 'kg' },
        { name: 'Múka', quantity: 300, unit: 'g', note: 'hladká' },
      ],
      steps: [{ text: 'Nastrúhaj jablká.' }, { text: 'Upeč.', timerSeconds: 2400 }],
      tags: ['Jesenné'],
    },
    as(by),
  )
  expect(res.status).toBe(201)
  return { recipe: await res.json<RecipeDetailDto>(), image }
}

const publish = (id: string, visibility: 'public' | 'private', by = A) =>
  send(app, 'PUT', api(`/recipes/${id}/visibility`), { visibility }, as(by))
const listPublic = async (by: string, query = '') =>
  (await (
    await send(app, 'GET', api(`/public/recipes${query}`), undefined, as(by))
  ).json()) as PublicRecipeSummaryDto[]

describe('verejné recepty', () => {
  it('nový recept je súkromný a nikto cudzí ho nevidí', async () => {
    await setup()
    const { recipe } = await createRecipe(A)
    expect(recipe.visibility).toBe('private')
    expect(await listPublic(B)).toEqual([])
    expect((await send(app, 'GET', api(`/public/recipes/${recipe.id}`), undefined, as(B))).status).toBe(404)
  })

  it('zverejnený recept vidia všetci prihlásení z iných domácností, s názvom domácnosti', async () => {
    await setup()
    const { recipe } = await createRecipe(A)
    expect((await publish(recipe.id, 'public')).status).toBe(200)

    const seenByB = await listPublic(B)
    expect(seenByB).toHaveLength(1)
    expect(seenByB[0]).toMatchObject({
      id: recipe.id,
      title: 'Grófkin koláč',
      category: 'dezert',
      householdName: 'Naša domácnosť',
      ownedByMe: false,
    })
    // vlastná domácnosť ho vidí tiež, označený ako vlastný
    expect((await listPublic(A))[0]).toMatchObject({ id: recipe.id, ownedByMe: true })
  })

  it('detail verejného receptu obsahuje ingrediencie a postup, ale nie údaje o cudzej špajzi', async () => {
    await setup()
    const { recipe } = await createRecipe(A)
    await send(app, 'PUT', api('/pantry/' + recipe.ingredients[0]!.ingredientId), {}, as(A))
    await publish(recipe.id, 'public')

    const res = await send(app, 'GET', api(`/public/recipes/${recipe.id}`), undefined, as(B))
    expect(res.status).toBe(200)
    const detail = await res.json<PublicRecipeDetailDto>()
    expect(detail.householdName).toBe('Naša domácnosť')
    expect(detail.ownedByMe).toBe(false)
    expect(detail.ingredients.map((i) => i.name)).toEqual(['Jablká', 'Múka'])
    expect(detail.steps.map((s) => s.text)).toEqual(['Nastrúhaj jablká.', 'Upeč.'])
    expect(detail.ingredients.every((i) => i.inPantry === false)).toBe(true)
  })

  it('zrušenie verejnosti alebo zmazanie receptu ho skryje', async () => {
    await setup()
    const { recipe } = await createRecipe(A)
    await publish(recipe.id, 'public')
    expect(await listPublic(B)).toHaveLength(1)
    await publish(recipe.id, 'private')
    expect(await listPublic(B)).toEqual([])

    await publish(recipe.id, 'public')
    await send(app, 'DELETE', api(`/recipes/${recipe.id}`), undefined, as(A))
    expect(await listPublic(B)).toEqual([])
  })

  it('viditeľnosť smie meniť len vlastník domácnosti a len vlastných receptov', async () => {
    const { aId } = await setup()
    await inviteMember(getDb(env), aId, 'clen@example.com', 'member')
    const { recipe } = await createRecipe(A)

    const asMember = await publish(recipe.id, 'public', 'clen@example.com')
    expect(asMember.status).toBe(403)
    expect((await asMember.json<ApiErrorBody>()).error.code).toBe('owner_required')
    // vlastník inej domácnosti cudzí recept zverejniť nemôže
    expect((await publish(recipe.id, 'public', B)).status).toBe(404)
  })

  it('filtrovanie podľa typu jedla a hľadanie podľa názvu', async () => {
    await setup()
    const kolac = (await createRecipe(A, 'Grófkin koláč')).recipe
    const soup = await (
      await send(app, 'POST', api('/recipes'), { title: 'Fazuľová polievka', category: 'polievka' }, as(A))
    ).json<RecipeDetailDto>()
    await publish(kolac.id, 'public')
    await publish(soup.id, 'public')

    expect((await listPublic(B, '?category=polievka')).map((r) => r.title)).toEqual(['Fazuľová polievka'])
    expect((await listPublic(B, '?q=grofkin')).map((r) => r.title)).toEqual(['Grófkin koláč'])
    expect(await listPublic(B, '?q=nic')).toEqual([])
  })

  it('typ jedla nájde aj recept, ktorý sa naň len „hodí aj ako“; kópia ho prevezme', async () => {
    await setup()
    const lievance = await (
      await send(
        app,
        'POST',
        api('/recipes'),
        { title: 'Lievance', category: 'ranajky', alsoCategories: ['desiata'] },
        as(A),
      )
    ).json<RecipeDetailDto>()
    await publish(lievance.id, 'public')
    expect((await listPublic(B, '?category=desiata')).map((r) => r.title)).toEqual(['Lievance'])
    const copy = await (
      await send(app, 'POST', api(`/public/recipes/${lievance.id}/copy`), undefined, as(B))
    ).json<RecipeDetailDto>()
    expect(copy.alsoCategories).toEqual(['desiata'])
  })

  it('kópia do vlastnej domácnosti je nezávislý recept s rovnakým obsahom', async () => {
    const { bId } = await setup()
    const { recipe } = await createRecipe(A)
    await publish(recipe.id, 'public')

    const res = await send(app, 'POST', api(`/public/recipes/${recipe.id}/copy`), undefined, as(B))
    expect(res.status).toBe(201)
    const copy = await res.json<RecipeDetailDto>()
    expect(copy.id).not.toBe(recipe.id)
    expect(copy).toMatchObject({
      title: 'Grófkin koláč',
      servings: 6,
      category: 'dezert',
      visibility: 'private',
    })
    expect(copy.ingredients.map((i) => [i.name, i.quantity, i.unit, i.note])).toEqual([
      ['Jablká', 1, 'kg', null],
      ['Múka', 300, 'g', 'hladká'],
    ])
    expect(copy.steps.map((s) => [s.text, s.timerSeconds])).toEqual([
      ['Nastrúhaj jablká.', null],
      ['Upeč.', 2400],
    ])
    expect(copy.tags.map((t) => t.name)).toEqual(['Jesenné'])

    // je v domácnosti B, nie v A
    const inB = (await (await send(app, 'GET', api('/recipes'), undefined, as(B))).json()) as RecipeListDto
    expect(inB.items.map((r) => r.id)).toEqual([copy.id])
    const inA = (await (await send(app, 'GET', api('/recipes'), undefined, as(A))).json()) as RecipeListDto
    expect(inA.items.map((r) => r.id)).toEqual([recipe.id])
    const row = await env.DB.prepare('select household_id from recipes where id = ?')
      .bind(copy.id)
      .first<{ household_id: string }>()
    expect(row?.household_id).toBe(bId)

    // zmena originálu sa v kópii neprejaví
    await send(app, 'PUT', api(`/recipes/${recipe.id}`), { title: 'Iný názov', servings: 2 }, as(A))
    const after = await (
      await send(app, 'GET', api(`/recipes/${copy.id}`), undefined, as(B))
    ).json<RecipeDetailDto>()
    expect(after.title).toBe('Grófkin koláč')
  })

  it('vlastný recept sa kopírovať nedá, súkromný cudzí tiež nie', async () => {
    await setup()
    const { recipe } = await createRecipe(A)
    expect((await send(app, 'POST', api(`/public/recipes/${recipe.id}/copy`), undefined, as(B))).status).toBe(
      404,
    )
    await publish(recipe.id, 'public')
    const own = await send(app, 'POST', api(`/public/recipes/${recipe.id}/copy`), undefined, as(A))
    expect(own.status).toBe(400)
    expect((await own.json<ApiErrorBody>()).error.code).toBe('own_recipe')
  })

  it('fotku verejného receptu vidí aj cudzia domácnosť, súkromnú nie', async () => {
    await setup()
    const { recipe, image } = await createRecipe(A, 'S fotkou', true)
    expect((await send(app, 'GET', image!.url, undefined, as(B))).status).toBe(404)
    await publish(recipe.id, 'public')
    expect((await send(app, 'GET', image!.url, undefined, as(A))).status).toBe(200)
    expect((await send(app, 'GET', image!.url, undefined, as(B))).status).toBe(200)
    await publish(recipe.id, 'private')
    expect((await send(app, 'GET', image!.url, undefined, as(B))).status).toBe(404)
  })

  it('kópia prenesie aj fotku do vlastnej domácnosti', async () => {
    const { bId } = await setup()
    const { recipe } = await createRecipe(A, 'S fotkou', true)
    await publish(recipe.id, 'public')
    const copy = await (
      await send(app, 'POST', api(`/public/recipes/${recipe.id}/copy`), undefined, as(B))
    ).json<RecipeDetailDto>()
    expect(copy.coverImageUrl).toMatch(new RegExp(`^/img/${bId}/`))
    expect((await send(app, 'GET', copy.coverImageUrl!, undefined, as(B))).status).toBe(200)
    expect(copy.coverImageUrl).not.toBe(recipe.coverImageUrl)
  })
})
