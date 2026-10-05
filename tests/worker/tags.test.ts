import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { RecipeDetailDto, TagDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

const tags = async () => (await send(app, 'GET', api('/tags'))).json<TagDto[]>()

describe('tagy – správa', () => {
  it('založí tag s farbou, premenuje ho a zmení farbu', async () => {
    const res = await send(app, 'POST', api('/tags'), { name: ' Rýchle ', color: '#5F7A3A' })
    expect(res.status).toBe(201)
    const tag = await res.json<TagDto>()
    expect(tag).toMatchObject({ name: 'Rýchle', color: '#5F7A3A', recipeCount: 0 })

    const renamed = await send(app, 'PUT', api(`/tags/${tag.id}`), { name: 'Bleskové', color: null })
    expect(renamed.status).toBe(200)
    expect(await renamed.json<TagDto>()).toMatchObject({ name: 'Bleskové', color: null })
    expect((await tags()).map((t) => t.name)).toEqual(['Bleskové'])
  })

  it('duplicitný názov (aj bez diakritiky) je 409', async () => {
    await send(app, 'POST', api('/tags'), { name: 'Detské' })
    expect((await send(app, 'POST', api('/tags'), { name: 'detske' })).status).toBe(409)
    const other = await (await send(app, 'POST', api('/tags'), { name: 'Rýchle' })).json<TagDto>()
    expect((await send(app, 'PUT', api(`/tags/${other.id}`), { name: 'DETSKÉ' })).status).toBe(409)
  })

  it('počíta recepty a zmazanie tagu ich odpojí, ale recepty ostanú', async () => {
    const recipe = await (
      await send(app, 'POST', api('/recipes'), { title: 'Guláš', tags: ['Klasika', 'Na víkend'] })
    ).json<RecipeDetailDto>()
    const list = await tags()
    expect(list.map((t) => [t.name, t.recipeCount])).toEqual([
      ['Klasika', 1],
      ['Na víkend', 1],
    ])
    const klasika = list.find((t) => t.name === 'Klasika')!
    expect((await send(app, 'DELETE', api(`/tags/${klasika.id}`))).status).toBe(204)
    expect((await tags()).map((t) => t.name)).toEqual(['Na víkend'])
    const detail = await (await send(app, 'GET', api(`/recipes/${recipe.id}`))).json<RecipeDetailDto>()
    expect(detail.tags.map((t) => t.name)).toEqual(['Na víkend'])
  })

  it('premenovanie tagu sa prejaví v recepte a farba sa vracia v zozname receptov', async () => {
    const recipe = await (
      await send(app, 'POST', api('/recipes'), { title: 'Guláš', tags: ['Klasika'] })
    ).json<RecipeDetailDto>()
    const tag = (await tags())[0]!
    await send(app, 'PUT', api(`/tags/${tag.id}`), { name: 'Klasika babky', color: '#B4532A' })
    const detail = await (await send(app, 'GET', api(`/recipes/${recipe.id}`))).json<RecipeDetailDto>()
    expect(detail.tags[0]).toMatchObject({ name: 'Klasika babky', color: '#B4532A' })
  })

  it('tag inej domácnosti je 404, neplatná farba 400', async () => {
    await tags()
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into tags (id, household_id, name, created_at, updated_at) values ('t-iny', 'iny', 'Cudzí', 'x', 'x')",
      ),
    ])
    expect((await send(app, 'PUT', api('/tags/t-iny'), { name: 'X' })).status).toBe(404)
    expect((await send(app, 'DELETE', api('/tags/t-iny'))).status).toBe(404)
    expect((await send(app, 'POST', api('/tags'), { name: 'Zlá', color: 'červená' })).status).toBe(400)
    expect(await tags()).toEqual([])
  })
})
