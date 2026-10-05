import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, IngredientDto, RecipeDetailDto, RecipeListDto, TagDto } from '@shared/api'
import type { RecipeInputRaw } from '@shared/schemas/recipe'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

const gulas: RecipeInputRaw = {
  title: 'Hovädzí guláš',
  description: 'Babkin recept.',
  category: 'hlavne',
  servings: 4,
  prepMinutes: 20,
  cookMinutes: 120,
  difficulty: 2,
  ingredients: [
    { name: 'Hovädzie mäso', quantity: 800, unit: 'g', isOptional: false },
    { name: 'Cibuľa', quantity: 3, unit: 'ks', note: 'veľké', isOptional: false },
    { name: 'Rasca', quantity: 1, unit: 'ČL', isOptional: true, groupName: 'Korenie' },
  ],
  steps: [{ text: 'Nakrájaj cibuľu.' }, { text: 'Opeč mäso.', timerSeconds: 600 }],
  tags: ['Klasika', 'Na víkend'],
}

async function create(input: RecipeInputRaw = gulas, as?: string) {
  const res = await send(app, 'POST', api('/recipes'), input, { as })
  expect(res.status).toBe(201)
  return res.json<RecipeDetailDto>()
}

const get = (id: string, as?: string) => send(app, 'GET', api(`/recipes/${id}`), undefined, { as })
const listFull = async (query = '', as?: string) => {
  const res = await send(app, 'GET', api(`/recipes${query}`), undefined, { as })
  expect(res.status).toBe(200)
  return res.json<RecipeListDto>()
}
const list = async (query = '', as?: string) => (await listFull(query, as)).items

describe('recepty – vytvorenie a detail', () => {
  it('uloží recept s ingredienciami, krokmi a tagmi v poradí', async () => {
    const created = await create()
    expect(created).toMatchObject({
      title: 'Hovädzí guláš',
      slug: 'hovadzi-gulas',
      servings: 4,
      difficulty: 2,
      isFavorite: false,
      coverImageUrl: null,
    })
    expect(
      created.ingredients.map((i) => [i.name, i.quantity, i.unit, i.note, i.groupName, i.isOptional]),
    ).toEqual([
      ['Hovädzie mäso', 800, 'g', null, null, false],
      ['Cibuľa', 3, 'ks', 'veľké', null, false],
      ['Rasca', 1, 'ČL', null, 'Korenie', true],
    ])
    expect(created.steps.map((s) => [s.position, s.text, s.timerSeconds])).toEqual([
      [1, 'Nakrájaj cibuľu.', null],
      [2, 'Opeč mäso.', 600],
    ])
    expect(created.tags.map((t) => t.name)).toEqual(['Klasika', 'Na víkend'])

    const res = await get(created.id)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(created)
  })

  it('ingrediencie a tagy znovu použije bez ohľadu na diakritiku a veľkosť písmen', async () => {
    await create()
    await create({
      title: 'Cibuľačka',
      ingredients: [{ name: 'cibula ', quantity: 5, unit: 'kg', isOptional: false }],
      tags: ['klasika'],
    })
    const ingredients = await (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()
    const onion = ingredients.filter((i) => i.name.toLowerCase().startsWith('cibu'))
    expect(onion).toHaveLength(1)
    expect(onion[0]).toMatchObject({ name: 'Cibuľa', defaultUnit: 'ks', usageCount: 2 })

    const tags = await (await send(app, 'GET', api('/tags'))).json<TagDto[]>()
    expect(tags.map((t) => t.name)).toEqual(['Klasika', 'Na víkend'])
  })

  it('uloží recept s 35 ingredienciami (limit parametrov D1)', async () => {
    const ingredients = Array.from({ length: 35 }, (_, i) => ({
      name: `Ingrediencia ${i + 1}`,
      quantity: i + 1,
      unit: 'g' as const,
      note: 'poznámka',
      groupName: 'Skupina',
      isOptional: false,
    }))
    const created = await create({ title: 'Veľký recept', ingredients, steps: [] })
    expect(created.ingredients).toHaveLength(35)
    expect(created.ingredients[34]!.name).toBe('Ingrediencia 35')
  })

  it('rovnaký názov dostane unikátny slug', async () => {
    const a = await create({ title: 'Palacinky' })
    const b = await create({ title: 'Palacinky' })
    const c = await create({ title: 'Palacinky' })
    expect([a.slug, b.slug, c.slug]).toEqual(['palacinky', 'palacinky-2', 'palacinky-3'])
  })

  it('neplatný vstup je 400 so zoznamom chýb', async () => {
    const res = await send(app, 'POST', api('/recipes'), { title: '', servings: 0 })
    expect(res.status).toBe(400)
    const body = await res.json<ApiErrorBody>()
    expect(body.error.code).toBe('validation_error')
    expect(Array.isArray(body.error.details)).toBe(true)
  })

  it('poškodený JSON je 400, nie 500', async () => {
    const res = await send(app, 'POST', api('/recipes'), undefined, {
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })
})

describe('recepty – úprava a mazanie', () => {
  it('úprava nahradí ingrediencie, kroky a tagy a zmení slug podľa názvu', async () => {
    const created = await create()
    const res = await send(app, 'PUT', api(`/recipes/${created.id}`), {
      title: 'Bravčový guláš',
      ingredients: [{ name: 'Bravčové mäso', quantity: 1, unit: 'kg', isOptional: false }],
      steps: [{ text: 'Uvar.' }],
      tags: ['Rýchle'],
    })
    expect(res.status).toBe(200)
    const updated = await res.json<RecipeDetailDto>()
    expect(updated.slug).toBe('bravcovy-gulas')
    expect(updated.ingredients.map((i) => i.name)).toEqual(['Bravčové mäso'])
    expect(updated.steps.map((s) => s.text)).toEqual(['Uvar.'])
    expect(updated.tags.map((t) => t.name)).toEqual(['Rýchle'])
  })

  it('úprava bez zmeny názvu ponechá slug', async () => {
    const created = await create()
    const res = await send(app, 'PUT', api(`/recipes/${created.id}`), { ...gulas, servings: 6 })
    expect((await res.json<RecipeDetailDto>()).slug).toBe('hovadzi-gulas')
  })

  it('zmazaný recept zmizne zo zoznamu a detail je 404', async () => {
    const created = await create()
    expect((await send(app, 'DELETE', api(`/recipes/${created.id}`))).status).toBe(204)
    expect(await list()).toEqual([])
    expect((await get(created.id)).status).toBe(404)
    expect((await send(app, 'PUT', api(`/recipes/${created.id}`), gulas)).status).toBe(404)
  })
})

describe('recepty – zoznam, vyhľadávanie a filtre', () => {
  it('hľadá v názve bez diakritiky a v ingredienciách', async () => {
    await create()
    await create({
      title: 'Palacinky',
      category: 'dezert',
      ingredients: [{ name: 'Mlieko', isOptional: false }],
    })
    expect((await list('?q=gulas')).map((r) => r.title)).toEqual(['Hovädzí guláš'])
    expect((await list('?q=CIBULA')).map((r) => r.title)).toEqual(['Hovädzí guláš'])
    expect((await list('?q=mliek')).map((r) => r.title)).toEqual(['Palacinky'])
    expect(await list('?q=xyz')).toEqual([])
    expect(await list('?q=%25')).toEqual([])
  })

  it('zoradí podľa názvu a filtruje podľa kategórie a tagu', async () => {
    const g = await create()
    await create({ title: 'Apple pie', category: 'dezert', tags: ['Sladké'] })
    expect((await list()).map((r) => r.title)).toEqual(['Apple pie', 'Hovädzí guláš'])
    expect((await list('?category=dezert')).map((r) => r.title)).toEqual(['Apple pie'])
    const tagId = g.tags.find((t) => t.name === 'Klasika')!.id
    expect((await list(`?tag=${tagId}`)).map((r) => r.title)).toEqual(['Hovädzí guláš'])
  })

  it('obľúbené sú pre každého používateľa zvlášť', async () => {
    const g = await create()
    await create({ title: 'Palacinky' })
    expect((await send(app, 'PUT', api(`/recipes/${g.id}/favorite`))).status).toBe(204)

    const mine = await list('?favorite=1')
    expect(mine.map((r) => [r.title, r.isFavorite])).toEqual([['Hovädzí guláš', true]])
    expect(await list('?favorite=1', 'manzelka@example.com')).toEqual([])
    expect((await (await get(g.id, 'manzelka@example.com')).json<RecipeDetailDto>()).isFavorite).toBe(false)

    expect((await send(app, 'DELETE', api(`/recipes/${g.id}/favorite`))).status).toBe(204)
    expect(await list('?favorite=1')).toEqual([])
  })
})

describe('recepty – izolácia domácností', () => {
  it('recept inej domácnosti nie je vidieť ani upraviť', async () => {
    await create()
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        `insert into recipes (id, household_id, title, title_normalized, slug, category, servings, difficulty, created_at, updated_at)
         values ('cudzi', 'iny', 'Cudzí guláš', 'cudzi gulas', 'cudzi-gulas', 'hlavne', 4, 1, 'x', 'x')`,
      ),
    ])
    expect((await list('?q=gulas')).map((r) => r.title)).toEqual(['Hovädzí guláš'])
    expect((await get('cudzi')).status).toBe(404)
    expect((await send(app, 'PUT', api('/recipes/cudzi'), gulas)).status).toBe(404)
    expect((await send(app, 'DELETE', api('/recipes/cudzi'))).status).toBe(404)
    expect((await send(app, 'PUT', api('/recipes/cudzi/favorite'))).status).toBe(404)
  })
})

describe('recepty – súbežné ukladanie', () => {
  it('súčasne uložené recepty s rovnakým názvom dostanú rôzne slugy namiesto chyby', async () => {
    const results = await Promise.all(
      [1, 2, 3].map(() => send(app, 'POST', api('/recipes'), { title: 'Palacinky' })),
    )
    expect(results.map((r) => r.status)).toEqual([201, 201, 201])
    const slugs = await Promise.all(results.map(async (r) => (await r.json<RecipeDetailDto>()).slug))
    expect(new Set(slugs).size).toBe(3)
  })
})

describe('recepty – filtre, počty a zoradenie', () => {
  const seed = async () => {
    await create({
      title: 'Palacinky',
      category: 'dezert',
      prepMinutes: 10,
      cookMinutes: 10,
      difficulty: 1,
      tags: ['Detské'],
    })
    await create({
      title: 'Rizoto',
      category: 'hlavne',
      prepMinutes: 15,
      cookMinutes: 30,
      difficulty: 2,
      tags: ['Rýchle'],
    })
    await create({
      title: 'Guláš',
      category: 'hlavne',
      prepMinutes: 20,
      cookMinutes: 120,
      difficulty: 3,
      tags: ['Klasika', 'Rýchle'],
    })
    await create({ title: 'Polievka', category: 'polievka', difficulty: 1 })
  }
  const titles = (items: { title: string }[]) => items.map((r) => r.title)

  it('viac hodnôt oddelených čiarkou je „alebo“, rôzne filtre „a“', async () => {
    await seed()
    expect(titles(await list('?category=dezert,polievka'))).toEqual(['Palacinky', 'Polievka'])
    expect(titles(await list('?category=hlavne&difficulty=3'))).toEqual(['Guláš'])
    expect(titles(await list('?time=do30'))).toEqual(['Palacinky'])
    expect(titles(await list('?time=do60,nad60'))).toEqual(['Guláš', 'Rizoto'])
  })

  it('vráti počty, ktoré sa neznižujú vlastným filtrom', async () => {
    await seed()
    const { facets } = await listFull('?category=hlavne')
    expect(facets.category).toEqual({ hlavne: 2, dezert: 1, polievka: 1 })
    expect(facets.difficulty).toEqual({ 2: 1, 3: 1 })
    expect(facets.time).toEqual({ do60: 1, nad60: 1 })
    const tagCounts = Object.values(facets.tag).sort()
    expect(tagCounts).toEqual([1, 2])
  })

  it('zoradí podľa času a náročnosti, recept bez času na konci', async () => {
    await seed()
    expect(titles(await list('?sort=time'))).toEqual(['Palacinky', 'Rizoto', 'Guláš', 'Polievka'])
    expect(titles(await list('?sort=time&dir=desc'))).toEqual(['Guláš', 'Rizoto', 'Palacinky', 'Polievka'])
    expect(titles(await list('?sort=difficulty&dir=desc'))).toEqual([
      'Guláš',
      'Rizoto',
      'Palacinky',
      'Polievka',
    ])
    expect(titles(await list('?sort=created'))).toEqual(['Polievka', 'Guláš', 'Rizoto', 'Palacinky'])
  })

  it('odmietne neplatnú hodnotu filtra', async () => {
    const res = await send(app, 'GET', api('/recipes?difficulty=9'))
    expect(res.status).toBe(400)
    expect((await send(app, 'GET', api('/recipes?sort=nic'))).status).toBe(400)
  })
})
