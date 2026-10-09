import { describe, expect, it } from 'vitest'
import type { RecipeDetailDto, RecipeListDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

const create = async (title: string, extra: object = {}) =>
  (await (await send(app, 'POST', api('/recipes'), { title, ...extra })).json()) as RecipeDetailDto
const detail = async (id: string) =>
  (await (await send(app, 'GET', api(`/recipes/${id}`))).json()) as RecipeDetailDto
const list = async (query = '') =>
  (await (await send(app, 'GET', api(`/recipes${query}`))).json()) as RecipeListDto

describe('overené recepty', () => {
  it('nový recept nie je overený; prepínač v detaile ho označí a zruší', async () => {
    const r = await create('Guláš')
    expect(r.isVerified).toBe(false)
    expect((await send(app, 'PUT', api(`/recipes/${r.id}/verified`))).status).toBe(204)
    expect((await detail(r.id)).isVerified).toBe(true)
    expect((await send(app, 'DELETE', api(`/recipes/${r.id}/verified`))).status).toBe(204)
    expect((await detail(r.id)).isVerified).toBe(false)
  })

  it('editor príznak uloží; staršia aplikácia bez poľa ho nemení', async () => {
    const r = await create('Rezeň', { isVerified: true })
    expect(r.isVerified).toBe(true)
    await send(app, 'PUT', api(`/recipes/${r.id}`), { title: 'Rezeň s kosťou' })
    expect((await detail(r.id)).isVerified).toBe(true)
    await send(app, 'PUT', api(`/recipes/${r.id}`), { title: 'Rezeň', isVerified: false })
    expect((await detail(r.id)).isVerified).toBe(false)
  })

  it('hromadná úprava označí vybrané recepty', async () => {
    const a = await create('A')
    const b = await create('B')
    const res = await send(app, 'POST', api('/recipes/bulk/update'), { ids: [a.id, b.id], verified: true })
    expect(res.status).toBe(200)
    expect((await detail(a.id)).isVerified).toBe(true)
    expect((await detail(b.id)).isVerified).toBe(true)
  })

  it('filter verified=1 nechá len overené a zoznam nesie príznak', async () => {
    const a = await create('Overený guláš', { isVerified: true })
    await create('Nový pokus')
    const all = await list()
    expect(all.items.find((x) => x.id === a.id)?.isVerified).toBe(true)
    expect((await list('?verified=1')).items.map((x) => x.title)).toEqual(['Overený guláš'])
  })
})
