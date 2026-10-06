import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, FamilyMemberDto, IngredientDto, PantryDto, StapleDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, count, send } from './helpers'

const app = createApp()

const create = async (name: string) =>
  (await (await send(app, 'POST', api('/ingredients'), { name })).json<IngredientDto>()).id
const list = async () => (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()
const remove = (id: string) => send(app, 'DELETE', api(`/ingredients/${id}`))

describe('DELETE /ingredients/:id', () => {
  it('zmaže nepoužitú ingredienciu, jej zásobu aj stálu položku', async () => {
    const id = await create('Oleja')
    await send(app, 'PUT', api(`/pantry/${id}`), { quantity: 1, unit: 'l' })
    await send(app, 'POST', api('/staples'), { name: 'Oleja', quantity: 1, unit: 'l' })

    const res = await remove(id)
    expect(res.status).toBe(204)
    expect((await list()).some((i) => i.id === id)).toBe(false)
    expect((await (await send(app, 'GET', api('/pantry'))).json<PantryDto>()).items).toEqual([])
    expect(await (await send(app, 'GET', api('/staples'))).json<StapleDto[]>()).toEqual([])
  })

  it('zmaže aj alergie a averzie, ktoré sa na ňu viazali', async () => {
    const id = await create('Orechy')
    const member = await (
      await send(app, 'POST', api('/members'), { name: 'Mama', kind: 'adult' })
    ).json<FamilyMemberDto>()
    await send(app, 'PUT', api(`/members/${member.id}/preferences`), { allergies: [id] })
    expect(await count('member_preferences')).toBe(1)
    await remove(id)
    expect(await count('member_preferences')).toBe(0)
  })

  it('ingredienciu použitú v receptoch nezmaže a povie v koľkých', async () => {
    await send(app, 'POST', api('/recipes'), {
      title: 'Palacinky',
      ingredients: [{ name: 'Múka', quantity: 200, unit: 'g' }],
    })
    await send(app, 'POST', api('/recipes'), {
      title: 'Koláč',
      ingredients: [{ name: 'Múka', quantity: 300, unit: 'g' }],
    })
    const muka = (await list()).find((i) => i.name === 'Múka')!
    const res = await remove(muka.id)
    expect(res.status).toBe(409)
    const error = (await res.json<ApiErrorBody>()).error
    expect(error.code).toBe('in_use')
    expect(error.message).toContain('2')
    expect((await list()).some((i) => i.id === muka.id)).toBe(true)
  })

  it('po zmazaní posledného receptu s ňou sa dá zmazať', async () => {
    const recipe = await (
      await send(app, 'POST', api('/recipes'), {
        title: 'Palacinky',
        ingredients: [{ name: 'Múka', quantity: 200, unit: 'g' }],
      })
    ).json<{ id: string }>()
    const muka = (await list()).find((i) => i.name === 'Múka')!
    await send(app, 'DELETE', api(`/recipes/${recipe.id}`))
    expect((await remove(muka.id)).status).toBe(204)
  })

  it('neznáma, už zmazaná a cudzia ingrediencia je 404', async () => {
    const id = await create('Oleja')
    expect((await remove('neexistuje')).status).toBe(404)
    await remove(id)
    expect((await remove(id)).status).toBe(404)

    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into ingredients (id, household_id, name, name_normalized, aliases, created_at, updated_at) values ('ing-iny', 'iny', 'Soľ', 'sol', '[]', 'x', 'x')",
      ),
    ])
    expect((await remove('ing-iny')).status).toBe(404)
  })

  it('rovnaký názov sa po zmazaní dá založiť znova', async () => {
    const id = await create('Oleja')
    await remove(id)
    const again = await send(app, 'POST', api('/ingredients'), { name: 'oleja' })
    expect(again.status).toBe(201)
    expect((await list()).filter((i) => i.name === 'oleja')).toHaveLength(1)
  })

  it('premenovanie opraví názov a zachová zásobu', async () => {
    const id = await create('Oleja')
    await send(app, 'PUT', api(`/pantry/${id}`), { quantity: 1, unit: 'l' })
    const res = await send(app, 'PUT', api(`/ingredients/${id}`), { name: 'Olej' })
    expect((await res.json<IngredientDto>()).name).toBe('Olej')
    const pantry = await (await send(app, 'GET', api('/pantry'))).json<PantryDto>()
    expect(pantry.items.map((i) => i.name)).toEqual(['Olej'])
  })
})
