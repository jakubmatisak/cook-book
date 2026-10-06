import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { RecipeListDto, SuggestionDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { ensureUser } from '../../worker/services/household'
import { api, send } from './helpers'

const app = createApp()

async function setup() {
  await ensureUser(getDb(env), 'ja@example.com')
  const create = (title: string, category: string) =>
    send(app, 'POST', api('/recipes'), {
      title,
      category,
      servings: 1,
      ingredients: [{ name: 'Jablko', quantity: 1, unit: 'ks' }],
      steps: [{ text: 'Uvar.' }],
    })
  await create('Hovädzí guláš', 'hlavne')
  await create('Ovsená kaša nemliečna', 'detske')
}

const list = async (query = '') =>
  (await (await send(app, 'GET', api(`/recipes${query}`))).json()) as RecipeListDto

describe('detské recepty', () => {
  it('zoznam ich predvolene skrýva, počty tiež', async () => {
    await setup()
    const result = await list()
    expect(result.items.map((r) => r.title)).toEqual(['Hovädzí guláš'])
    expect(result.facets.category).toEqual({ hlavne: 1 })
  })

  it('kids=1 ich zahrnie, rovnako ako výslovne zvolená kategória detske', async () => {
    await setup()
    expect((await list('?kids=1')).items.map((r) => r.title).sort()).toEqual([
      'Hovädzí guláš',
      'Ovsená kaša nemliečna',
    ])
    expect((await list('?category=detske')).items.map((r) => r.title)).toEqual(['Ovsená kaša nemliečna'])
  })

  it('detské recepty sa nenavrhujú v „čo uvariť dnes“', async () => {
    await setup()
    const res = await send(app, 'GET', api('/recipes/suggestions?date=2026-10-06'))
    const titles = ((await res.json()) as SuggestionDto[]).map((s) => s.title)
    expect(titles).toContain('Hovädzí guláš')
    expect(titles).not.toContain('Ovsená kaša nemliečna')
  })

  it('detail detského receptu ide otvoriť normálne', async () => {
    await setup()
    const all = await list('?kids=1')
    const kids = all.items.find((r) => r.category === 'detske')!
    expect((await send(app, 'GET', api(`/recipes/${kids.id}`))).status).toBe(200)
  })
})
