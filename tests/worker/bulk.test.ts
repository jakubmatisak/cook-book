import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type {
  ApiErrorBody,
  BulkAffectedDto,
  IngredientBulkDeleteResult,
  IngredientDto,
  PlanEntryDto,
  RecipeDetailDto,
  RecipeListDto,
} from '@shared/api'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { createHousehold, ensureUser } from '../../worker/services/household'
import { recipes } from '../../worker/db/schema'
import { inviteMember } from '../../worker/services/memberships'
import { api, send } from './helpers'

const app = createApp()
const OWNER = 'ja@example.com'
const MEMBER = 'clen@example.com'
const as = (email: string) => ({ as: email })

async function recipe(title: string, extra: Record<string, unknown> = {}, by = OWNER) {
  const res = await send(
    app,
    'POST',
    api('/recipes'),
    {
      title,
      servings: 2,
      ingredients: [{ name: 'Jablko', quantity: 1, unit: 'ks' }],
      steps: [{ text: 'Uvar.' }],
      ...extra,
    },
    as(by),
  )
  expect(res.status).toBe(201)
  return (await res.json<RecipeDetailDto>()).id
}
const list = async (by = OWNER) =>
  (await (await send(app, 'GET', api('/recipes?kids=1'), undefined, as(by))).json()) as RecipeListDto
const detail = async (id: string, by = OWNER) =>
  (await (await send(app, 'GET', api(`/recipes/${id}`), undefined, as(by))).json()) as RecipeDetailDto
const post = (path: string, body: unknown, by = OWNER) => send(app, 'POST', api(path), body, as(by))

async function slotId() {
  const me = (await (await send(app, 'GET', api('/me'), undefined, as(OWNER))).json()) as {
    slots: { id: string }[]
  }
  return me.slots[0]!.id
}

describe('hromadné mazanie receptov', () => {
  it('zmaže vybrané recepty a ich záznamy v jedálničku, ostatné nechá', async () => {
    await ensureUser(getDb(env), OWNER)
    const a = await recipe('Guláš')
    const b = await recipe('Rezeň')
    const c = await recipe('Polievka')
    await send(
      app,
      'POST',
      api('/plan/entries'),
      { date: '2026-10-06', slotId: await slotId(), recipeId: a, servings: 2 },
      as(OWNER),
    )
    const res = await post('/recipes/bulk/delete', { ids: [a, b, 'neexistuje'] })
    expect(res.status).toBe(200)
    expect((await res.json<BulkAffectedDto>()).affected).toBe(2)
    expect((await list()).items.map((r) => r.title)).toEqual(['Polievka'])
    expect((await send(app, 'GET', api(`/recipes/${c}`), undefined, as(OWNER))).status).toBe(200)
    const plan = (await (
      await send(app, 'GET', api('/plan?from=2026-10-05&to=2026-10-11'), undefined, as(OWNER))
    ).json()) as PlanEntryDto[]
    expect(plan.filter((e) => e.recipe?.id === a)).toHaveLength(0)
  })

  it('cudzie recepty (iná domácnosť) sa nedotknú', async () => {
    await ensureUser(getDb(env), OWNER)
    const other = await createHousehold(getDb(env), 'Rodičia')
    const [foreign] = await getDb(env)
      .insert(recipes)
      .values({ householdId: other, title: 'Cudzí', titleNormalized: 'cudzi', slug: 'cudzi', servings: 2 })
      .returning({ id: recipes.id })
    const res = await post('/recipes/bulk/delete', { ids: [foreign!.id] })
    expect((await res.json<BulkAffectedDto>()).affected).toBe(0)
    const kept = await getDb(env)
      .select({ deletedAt: recipes.deletedAt })
      .from(recipes)
      .where(eq(recipes.id, foreign!.id))
    expect(kept[0]!.deletedAt).toBeNull()
    const upd = await post('/recipes/bulk/update', { ids: [foreign!.id], category: 'dezert' })
    expect((await upd.json<BulkAffectedDto>()).affected).toBe(0)
  })

  it('odmietne prázdny zoznam a viac než 50 id', async () => {
    await ensureUser(getDb(env), OWNER)
    expect((await post('/recipes/bulk/delete', { ids: [] })).status).toBe(400)
    const many = Array.from({ length: 51 }, (_, i) => `id${i}`)
    expect((await post('/recipes/bulk/delete', { ids: many })).status).toBe(400)
  })
})

describe('hromadná úprava receptov', () => {
  it('zmení kategóriu vybraným receptom', async () => {
    await ensureUser(getDb(env), OWNER)
    const a = await recipe('Palacinky', { category: 'hlavne' })
    const b = await recipe('Koláč', { category: 'hlavne' })
    const c = await recipe('Guláš', { category: 'hlavne' })
    const res = await post('/recipes/bulk/update', { ids: [a, b], category: 'dezert' })
    expect((await res.json<BulkAffectedDto>()).affected).toBe(2)
    expect((await detail(a)).category).toBe('dezert')
    expect((await detail(b)).category).toBe('dezert')
    expect((await detail(c)).category).toBe('hlavne')
  })

  it('pridá štítky (nové sa založia, existujúce sa nezdvoja) a odoberie iné', async () => {
    await ensureUser(getDb(env), OWNER)
    const a = await recipe('Guláš', { tags: ['rýchle'] })
    const b = await recipe('Rezeň')
    await post('/recipes/bulk/update', { ids: [a, b], addTags: ['Rýchle', 'víkend'] })
    expect((await detail(a)).tags.map((t) => t.name).sort()).toEqual(['rýchle', 'víkend'])
    expect((await detail(b)).tags.map((t) => t.name).sort()).toEqual(['rýchle', 'víkend'])
    await post('/recipes/bulk/update', { ids: [a, b], removeTags: ['rychle', 'neexistuje'] })
    expect((await detail(a)).tags.map((t) => t.name)).toEqual(['víkend'])
    expect((await detail(b)).tags.map((t) => t.name)).toEqual(['víkend'])
  })

  it('pridá a odoberie obľúbené len pre toho, kto ich mení', async () => {
    const owner = await ensureUser(getDb(env), OWNER)
    await inviteMember(getDb(env), owner.householdId, MEMBER, 'member')
    const a = await recipe('Guláš')
    const b = await recipe('Rezeň')
    await post('/recipes/bulk/update', { ids: [a, b], favorite: true })
    expect((await detail(a)).isFavorite).toBe(true)
    expect((await detail(a, MEMBER)).isFavorite).toBe(false)
    await post('/recipes/bulk/update', { ids: [a], favorite: false })
    expect((await detail(a)).isFavorite).toBe(false)
    expect((await detail(b)).isFavorite).toBe(true)
  })

  it('viditeľnosť smie meniť len vlastník domácnosti', async () => {
    const owner = await ensureUser(getDb(env), OWNER)
    await inviteMember(getDb(env), owner.householdId, MEMBER, 'member')
    const a = await recipe('Guláš')
    const denied = await post('/recipes/bulk/update', { ids: [a], visibility: 'public' }, MEMBER)
    expect(denied.status).toBe(403)
    expect((await denied.json<ApiErrorBody>()).error.code).toBe('owner_required')
    expect((await detail(a)).visibility).toBe('private')
    expect((await post('/recipes/bulk/update', { ids: [a], visibility: 'public' })).status).toBe(200)
    expect((await detail(a)).visibility).toBe('public')
    // člen smie meniť ostatné polia
    expect((await post('/recipes/bulk/update', { ids: [a], category: 'dezert' }, MEMBER)).status).toBe(200)
  })

  it('bez akejkoľvek zmeny alebo s neplatnou kategóriou je to chyba', async () => {
    await ensureUser(getDb(env), OWNER)
    const a = await recipe('Guláš')
    expect((await post('/recipes/bulk/update', { ids: [a] })).status).toBe(400)
    expect((await post('/recipes/bulk/update', { ids: [a], category: 'xx' })).status).toBe(400)
  })

  it('viac receptov naraz sa zmení v jednom volaní', async () => {
    await ensureUser(getDb(env), OWNER)
    const ids: string[] = []
    for (let i = 0; i < 12; i++) ids.push(await recipe(`Recept ${i}`))
    const res = await post('/recipes/bulk/update', {
      ids,
      category: 'ranajky',
      addTags: ['a', 'b', 'c'],
      favorite: true,
    })
    expect((await res.json<BulkAffectedDto>()).affected).toBe(12)
    const sample = await detail(ids[11]!)
    expect(sample.category).toBe('ranajky')
    expect(sample.tags).toHaveLength(3)
    expect(sample.isFavorite).toBe(true)
  })
})

describe('hromadné úpravy ingrediencií', () => {
  const createIng = async (name: string) =>
    (await (await post('/ingredients', { name })).json<IngredientDto>()).id
  const ingList = async () =>
    (await (await send(app, 'GET', api('/ingredients'), undefined, as(OWNER))).json()) as IngredientDto[]
  const shopCategory = async () =>
    (
      (await (await send(app, 'GET', api('/shop-categories'), undefined, as(OWNER))).json()) as {
        id: string
      }[]
    )[0]!.id

  it('priradí kategóriu obchodu a jednotku vybraným ingredienciám', async () => {
    await ensureUser(getDb(env), OWNER)
    const a = await createIng('Mrkva')
    const b = await createIng('Cibuľa')
    const c = await createIng('Soľ')
    const cat = await shopCategory()
    const res = await post('/ingredients/bulk/update', {
      ids: [a, b],
      shopCategoryId: cat,
      defaultUnit: 'kg',
    })
    expect((await res.json<BulkAffectedDto>()).affected).toBe(2)
    const all = await ingList()
    expect(all.find((i) => i.id === a)).toMatchObject({ shopCategoryId: cat, defaultUnit: 'kg' })
    expect(all.find((i) => i.id === b)).toMatchObject({ shopCategoryId: cat, defaultUnit: 'kg' })
    expect(all.find((i) => i.id === c)).toMatchObject({ shopCategoryId: null })
  })

  it('kategóriu možno aj vymazať (null); neexistujúca kategória a prázdna zmena sú chyba', async () => {
    await ensureUser(getDb(env), OWNER)
    const a = await createIng('Mrkva')
    const cat = await shopCategory()
    await post('/ingredients/bulk/update', { ids: [a], shopCategoryId: cat })
    await post('/ingredients/bulk/update', { ids: [a], shopCategoryId: null })
    expect((await ingList()).find((i) => i.id === a)?.shopCategoryId).toBeNull()
    expect((await post('/ingredients/bulk/update', { ids: [a], shopCategoryId: 'neexistuje' })).status).toBe(
      400,
    )
    expect((await post('/ingredients/bulk/update', { ids: [a] })).status).toBe(400)
  })

  it('zmaže nepoužité a použité v receptoch preskočí', async () => {
    await ensureUser(getDb(env), OWNER)
    const unused = await createIng('Soľ')
    await recipe('Guláš') // používa Jablko
    const used = (await ingList()).find((i) => i.name === 'Jablko')!.id
    const res = await post('/ingredients/bulk/delete', { ids: [unused, used] })
    const body = await res.json<IngredientBulkDeleteResult>()
    expect(body.deleted).toBe(1)
    expect(body.skipped).toEqual(['Jablko'])
    const names = (await ingList()).map((i) => i.name)
    expect(names).toContain('Jablko')
    expect(names).not.toContain('Soľ')
  })
})
