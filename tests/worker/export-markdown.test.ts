import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { RecipeDetailDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

const create = async (body: object) =>
  (await (await send(app, 'POST', api('/recipes'), body)).json<RecipeDetailDto>()).id

const gulas = {
  title: 'Hovädzí guláš',
  description: 'Babkin recept.',
  category: 'hlavne',
  servings: 4,
  prepMinutes: 20,
  cookMinutes: 120,
  difficulty: 2,
  tags: ['Klasika'],
  ingredients: [
    { name: 'Hovädzie mäso', quantity: 800, unit: 'g', isOptional: false },
    { name: 'Rasca', quantity: 1, unit: 'ČL', isOptional: true, groupName: 'Korenie' },
  ],
  steps: [{ text: 'Nakrájaj cibuľu.' }, { text: 'Opeč mäso.', timerSeconds: 600 }],
}

describe('GET /recipes/:id/export.md', () => {
  it('vráti recept ako súbor Markdown', async () => {
    const id = await create(gulas)
    const res = await send(app, 'GET', api(`/recipes/${id}/export.md`))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/markdown')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="hovadzi-gulas.md"')
    const text = await res.text()
    expect(text).toContain('# Hovädzí guláš')
    expect(text).toContain('- 800 g Hovädzie mäso')
    expect(text).toContain('### Korenie')
    expect(text).toContain('2. Opeč mäso. *(časovač 10 min)*')
    expect(text).toContain('**Tagy:** #Klasika')
  })

  it('súbor začína značkou UTF-8 (BOM), aby ho Android a Windows nečítali v inom kódovaní', async () => {
    const id = await create(gulas)
    const one = new Uint8Array(await (await send(app, 'GET', api(`/recipes/${id}/export.md`))).arrayBuffer())
    expect([...one.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const all = new Uint8Array(await (await send(app, 'GET', api('/export/recipes.md'))).arrayBuffer())
    expect([...all.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })

  it('prepočíta porcie podľa ?servings= (aj staršieho ?porcie=)', async () => {
    const id = await create(gulas)
    const text = await (await send(app, 'GET', api(`/recipes/${id}/export.md?servings=8`))).text()
    expect(text).toContain('8 porcií')
    const legacy = await (await send(app, 'GET', api(`/recipes/${id}/export.md?porcie=8`))).text()
    expect(legacy).toContain('8 porcií')
    expect(text).toContain('- 1,6 kg Hovädzie mäso')
  })

  it('neplatný počet porcií je 400, neznámy a cudzí recept 404', async () => {
    const id = await create(gulas)
    expect((await send(app, 'GET', api(`/recipes/${id}/export.md?servings=0`))).status).toBe(400)
    expect((await send(app, 'GET', api(`/recipes/${id}/export.md?servings=abc`))).status).toBe(400)
    expect((await send(app, 'GET', api('/recipes/neexistuje/export.md'))).status).toBe(404)
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into recipes (id, household_id, title, title_normalized, slug, category, servings, difficulty, created_at, updated_at) values ('r-iny', 'iny', 'Cudzí', 'cudzi', 'cudzi', 'hlavne', 4, 1, 'x', 'x')",
      ),
    ])
    expect((await send(app, 'GET', api('/recipes/r-iny/export.md'))).status).toBe(404)
  })
})

describe('GET /export/recipes.md', () => {
  it('všetky recepty domácnosti v jednom súbore podľa abecedy, bez zmazaných a cudzích', async () => {
    await create(gulas)
    await create({
      title: 'Palacinky',
      servings: 3,
      ingredients: [{ name: 'Múka', quantity: 200, unit: 'g' }],
    })
    const zmazany = await create({ title: 'Zmazaný', servings: 2 })
    await send(app, 'DELETE', api(`/recipes/${zmazany}`))
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into recipes (id, household_id, title, title_normalized, slug, category, servings, difficulty, created_at, updated_at) values ('r-iny', 'iny', 'Cudzí', 'cudzi', 'cudzi', 'hlavne', 4, 1, 'x', 'x')",
      ),
    ])

    const res = await send(app, 'GET', api('/export/recipes.md'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/markdown')
    expect(res.headers.get('content-disposition')).toMatch(
      /^attachment; filename="kucharska-kniha-recepty-\d{4}-\d{2}-\d{2}\.md"$/,
    )
    const text = await res.text()
    expect(text.indexOf('# Hovädzí guláš')).toBeGreaterThanOrEqual(0)
    expect(text.indexOf('# Hovädzí guláš')).toBeLessThan(text.indexOf('# Palacinky'))
    expect(text).toContain('\n---\n\n# Palacinky')
    expect(text).toContain('- 800 g Hovädzie mäso')
    expect(text).toContain('- 200 g Múka')
    expect(text).toContain('2. Opeč mäso. *(časovač 10 min)*')
    expect(text).not.toContain('Zmazaný')
    expect(text).not.toContain('Cudzí')
  })

  it('bez receptov vráti prázdny súbor', async () => {
    const res = await send(app, 'GET', api('/export/recipes.md'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
  })
})
