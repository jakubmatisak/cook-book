import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { RecipeListDto, RecipeSummaryDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { households, recipes, recipeTags, tags } from '../../worker/db/schema'
import { createHousehold, ensureUser } from '../../worker/services/household'
import { api, send } from './helpers'

const app = createApp()

/** Domácnosť ja@example.com + cudzia domácnosť „Rodičia“ s receptami (verejnými aj súkromnými). */
async function setup() {
  await ensureUser(getDb(env), 'ja@example.com')
  const other = await createHousehold(getDb(env), 'Rodičia')
  const db = getDb(env)
  const add = async (title: string, over: Partial<typeof recipes.$inferInsert> = {}, householdId = other) => {
    const [row] = await db
      .insert(recipes)
      .values({
        householdId,
        title,
        titleNormalized: title.toLowerCase(),
        slug: title.toLowerCase().replace(/\s+/g, '-'),
        servings: 2,
        category: 'hlavne',
        ...over,
      })
      .returning({ id: recipes.id })
    return row!.id
  }
  return { other, add, db }
}

const mine = async (title: string, extra: Record<string, unknown> = {}) =>
  send(app, 'POST', api('/recipes'), {
    title,
    servings: 2,
    ingredients: [{ name: 'Jablko', quantity: 1, unit: 'ks' }],
    steps: [{ text: 'Uvar.' }],
    ...extra,
  })

const list = async (query = '') =>
  (await (await send(app, 'GET', api(`/recipes${query}`))).json()) as RecipeListDto
const titles = (l: RecipeListDto) => l.items.map((r) => r.title).sort()

describe('verejné recepty iných domácností v zozname receptov', () => {
  it('predvolene sa cudzie verejné recepty nezobrazia', async () => {
    const { add } = await setup()
    await add('Cudzí guláš', { visibility: 'public' })
    await mine('Môj rezeň')
    expect(titles(await list())).toEqual(['Môj rezeň'])
    expect(titles(await list('?public=hide'))).toEqual(['Môj rezeň'])
  })

  it('public=include pridá cudzie verejné recepty s názvom domácnosti', async () => {
    const { add } = await setup()
    await add('Cudzí guláš', { visibility: 'public' })
    await mine('Môj rezeň')
    const result = await list('?public=include')
    expect(titles(result)).toEqual(['Cudzí guláš', 'Môj rezeň'])
    const foreign = result.items.find((r) => r.title === 'Cudzí guláš') as RecipeSummaryDto
    expect(foreign.householdName).toBe('Rodičia')
    expect(foreign.visibility).toBe('public')
    expect(foreign.isFavorite).toBe(false)
    expect(result.items.find((r) => r.title === 'Môj rezeň')?.householdName).toBeUndefined()
  })

  it('cudzie súkromné a zmazané recepty sa nezobrazia nikdy', async () => {
    const { add } = await setup()
    await add('Cudzí súkromný', { visibility: 'private' })
    await add('Cudzí zmazaný', { visibility: 'public', deletedAt: new Date().toISOString() })
    expect(titles(await list('?public=include'))).toEqual([])
    expect(titles(await list('?public=only'))).toEqual([])
  })

  it('public=only ukáže len recepty iných domácností (aj moje verejné ostanú mimo)', async () => {
    const { add } = await setup()
    await add('Cudzí guláš', { visibility: 'public' })
    await mine('Môj súkromný')
    const res = await mine('Môj verejný')
    const id = ((await res.json()) as { id: string }).id
    await send(app, 'PUT', api(`/recipes/${id}/visibility`), { visibility: 'public' })
    expect(titles(await list('?public=only'))).toEqual(['Cudzí guláš'])
    expect(titles(await list('?public=include'))).toEqual(['Cudzí guláš', 'Môj súkromný', 'Môj verejný'])
  })

  it('hľadanie a typ jedla platia aj pre cudzie recepty', async () => {
    const { add } = await setup()
    await add('Cudzí guláš', { visibility: 'public' })
    await add('Cudzí koláč', { visibility: 'public', category: 'dezert' })
    expect(titles(await list('?public=include&q=gul'))).toEqual(['Cudzí guláš'])
    expect(titles(await list('?public=include&category=dezert'))).toEqual(['Cudzí koláč'])
  })

  it('počty vo filtroch zahŕňajú zahrnuté cudzie recepty', async () => {
    const { add } = await setup()
    await add('Cudzí koláč', { visibility: 'public', category: 'dezert' })
    await mine('Môj guláš')
    expect((await list()).facets.category).toEqual({ hlavne: 1 })
    expect((await list('?public=include')).facets.category).toEqual({ hlavne: 1, dezert: 1 })
  })

  it('štítky cudzieho receptu sa porovnávajú podľa názvu s mojimi štítkami', async () => {
    const { add, db, other } = await setup()
    const id = await add('Cudzí guláš', { visibility: 'public' })
    const [foreignTag] = await db
      .insert(tags)
      .values({ householdId: other, name: 'Rýchle' })
      .returning({ id: tags.id })
    await db.insert(recipeTags).values({ recipeId: id, tagId: foreignTag!.id })
    await mine('Môj rezeň', { tags: ['rýchle'] })
    const myTag = (
      (await (await send(app, 'GET', api('/tags'))).json()) as { id: string; name: string }[]
    ).find((t) => t.name === 'rýchle')!
    const result = await list(`?public=include&tag=${myTag.id}`)
    expect(titles(result)).toEqual(['Cudzí guláš', 'Môj rezeň'])
    expect(result.items.find((r) => r.title === 'Cudzí guláš')?.tags.map((t) => t.name)).toEqual(['Rýchle'])
  })

  it('detské cudzie recepty sa riadia rovnakým prepínačom ako moje', async () => {
    const { add } = await setup()
    await add('Cudzia kaša', { visibility: 'public', category: 'detske' })
    expect(titles(await list('?public=include'))).toEqual([])
    expect(titles(await list('?public=include&kids=1'))).toEqual(['Cudzia kaša'])
  })

  it('„čo viem uvariť“ (pantry) cudzie recepty nezahŕňa a obľúbené filter ich nevráti', async () => {
    const { add } = await setup()
    await add('Cudzí guláš', { visibility: 'public' })
    expect(titles(await list('?public=include&pantry=1'))).toEqual([])
    expect(titles(await list('?public=include&favorite=1'))).toEqual([])
  })

  it('neplatná hodnota public je chyba', async () => {
    await setup()
    expect((await send(app, 'GET', api('/recipes?public=xx'))).status).toBe(400)
  })

  it('moje vlastné verejné recepty sa nezdvoja a nepatrí im householdName', async () => {
    await setup()
    const res = await mine('Môj verejný')
    const id = ((await res.json()) as { id: string }).id
    await send(app, 'PUT', api(`/recipes/${id}/visibility`), { visibility: 'public' })
    const result = await list('?public=include')
    expect(titles(result)).toEqual(['Môj verejný'])
    expect(result.items[0]!.householdName).toBeUndefined()
    expect(result.items[0]!.visibility).toBe('public')
    expect(households).toBeDefined()
  })
})

describe('nastavenie „Zobrazovať recepty od iných“', () => {
  it('zapnuté pridá cudzie verejné recepty do zoznamu aj bez parametra; public=hide ich skryje', async () => {
    const { add } = await setup()
    await add('Cudzí guláš', { visibility: 'public' })
    await mine('Môj rezeň')
    expect((await send(app, 'PUT', api('/me/settings'), { showOthersRecipes: true })).status).toBe(200)

    expect(titles(await list())).toEqual(['Cudzí guláš', 'Môj rezeň'])
    expect(titles(await list('?public=hide'))).toEqual(['Môj rezeň'])
    expect(titles(await list('?public=only'))).toEqual(['Cudzí guláš'])

    await send(app, 'PUT', api('/me/settings'), { showOthersRecipes: null })
    expect(titles(await list())).toEqual(['Môj rezeň'])
  })
})
