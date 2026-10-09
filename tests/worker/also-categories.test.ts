import { describe, expect, it } from 'vitest'
import type { ComposeItem } from '@shared/compose'
import type { MeResponse, RecipeDetailDto, RecipeListDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

const create = async (body: object) => {
  const res = await send(app, 'POST', api('/recipes'), { servings: 2, ...body })
  expect(res.status).toBe(201)
  return res.json<RecipeDetailDto>()
}
const detail = async (id: string) => (await send(app, 'GET', api(`/recipes/${id}`))).json<RecipeDetailDto>()
const list = async (query = '') => (await send(app, 'GET', api(`/recipes${query}`))).json<RecipeListDto>()

describe('Hodí sa aj ako', () => {
  it('uloží ďalšie typy jedla bez hlavného a bez opakovania, v poradí kategórií', async () => {
    const r = await create({
      title: 'Lievance',
      category: 'ranajky',
      alsoCategories: ['dezert', 'ranajky', 'desiata', 'desiata'],
    })
    expect(r.alsoCategories).toEqual(['dezert', 'desiata'])
    expect((await list()).items[0]!.alsoCategories).toEqual(['dezert', 'desiata'])
  })

  it('úprava bez poľa ich nechá, prázdne pole ich zmaže', async () => {
    const r = await create({ title: 'Lievance', category: 'ranajky', alsoCategories: ['desiata'] })
    await send(app, 'PUT', api(`/recipes/${r.id}`), { title: 'Lievance', category: 'ranajky' })
    expect((await detail(r.id)).alsoCategories).toEqual(['desiata'])
    await send(app, 'PUT', api(`/recipes/${r.id}`), {
      title: 'Lievance',
      category: 'ranajky',
      alsoCategories: [],
    })
    expect((await detail(r.id)).alsoCategories).toEqual([])
  })

  it('filter typu jedla a počty berú aj „hodí sa aj ako“', async () => {
    await create({ title: 'Lievance', category: 'ranajky', alsoCategories: ['desiata'] })
    await create({ title: 'Kaša', category: 'ranajky' })
    const desiata = await list('?category=desiata')
    expect(desiata.items.map((i) => i.title)).toEqual(['Lievance'])
    expect((await list()).facets.category).toMatchObject({ ranajky: 2, desiata: 1 })
  })

  it('hromadne pridá a odoberie typ jedla', async () => {
    const a = await create({ title: 'Lievance', category: 'ranajky' })
    const b = await create({ title: 'Kaša', category: 'ranajky', alsoCategories: ['dezert'] })
    const res = await send(app, 'POST', api('/recipes/bulk/update'), {
      ids: [a.id, b.id],
      addCategories: ['desiata', 'ranajky'],
      removeCategories: ['dezert'],
    })
    expect(res.status).toBe(200)
    expect((await detail(a.id)).alsoCategories).toEqual(['desiata'])
    expect((await detail(b.id)).alsoCategories).toEqual(['desiata'])
  })

  it('sprievodca ponúkne recept aj v jedle dňa, kam sa hodí len „aj ako“', async () => {
    const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
    const desiata = me.slots.find((s) => s.name === 'Desiata')!.id
    const r = await create({ title: 'Lievance', category: 'ranajky', alsoCategories: ['desiata'] })
    const res = await send(app, 'POST', api('/plan/compose'), {
      cells: [{ date: '2026-10-12', slotId: desiata, brush: 'all' }],
      slots: [{ slotId: desiata, categories: ['desiata'], withSoup: false }],
      seed: 1,
    })
    expect(res.status).toBe(200)
    expect((await res.json<ComposeItem[]>())[0]!.recipeId).toBe(r.id)
  })
})
