import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { IngredientDto, ShopCategoryDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

const categories = async () => (await send(app, 'GET', api('/shop-categories'))).json<ShopCategoryDto[]>()

describe('kategórie obchodu', () => {
  it('vráti predvolené kategórie v poradí', async () => {
    const list = await categories()
    expect(list).toHaveLength(13)
    expect(list.map((c) => c.name).slice(4, 8)).toEqual([
      'Pečivo',
      'Pečenie',
      'Trvanlivé',
      'Konzervy a zaváraniny',
    ])
    expect(list[0]!.name).toBe('Zelenina')
    expect(list.at(-1)!.name).toBe('Iné')
  })
})

describe('ingrediencie', () => {
  it('založí ingredienciu a duplicitný názov odmietne', async () => {
    const res = await send(app, 'POST', api('/ingredients'), { name: 'Mrkva', defaultUnit: 'ks' })
    expect(res.status).toBe(201)
    expect(await res.json<IngredientDto>()).toMatchObject({ name: 'Mrkva', defaultUnit: 'ks', usageCount: 0 })

    const dup = await send(app, 'POST', api('/ingredients'), { name: ' mrkva' })
    expect(dup.status).toBe(409)
  })

  it('zmení kategóriu obchodu, jednotku a názov', async () => {
    const zelenina = (await categories())[0]!
    const created = await (
      await send(app, 'POST', api('/ingredients'), { name: 'Mrkva' })
    ).json<IngredientDto>()
    const res = await send(app, 'PUT', api(`/ingredients/${created.id}`), {
      name: 'Mrkva čerstvá',
      shopCategoryId: zelenina.id,
      defaultUnit: 'kg',
    })
    expect(res.status).toBe(200)
    expect(await res.json<IngredientDto>()).toMatchObject({
      name: 'Mrkva čerstvá',
      shopCategoryId: zelenina.id,
      defaultUnit: 'kg',
    })
  })

  it('premenovanie na existujúci názov je 409', async () => {
    await send(app, 'POST', api('/ingredients'), { name: 'Mrkva' })
    const petrzlen = await (
      await send(app, 'POST', api('/ingredients'), { name: 'Petržlen' })
    ).json<IngredientDto>()
    const res = await send(app, 'PUT', api(`/ingredients/${petrzlen.id}`), { name: 'MRKVA' })
    expect(res.status).toBe(409)
  })

  it('kategória inej domácnosti je 400, ingrediencia inej domácnosti 404', async () => {
    const created = await (
      await send(app, 'POST', api('/ingredients'), { name: 'Mrkva' })
    ).json<IngredientDto>()
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into shop_categories (id, household_id, name, sort_order, created_at, updated_at) values ('kat-iny', 'iny', 'Cudzia', 0, 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into ingredients (id, household_id, name, name_normalized, aliases, created_at, updated_at) values ('ing-iny', 'iny', 'Soľ', 'sol', '[]', 'x', 'x')",
      ),
    ])
    const bad = await send(app, 'PUT', api(`/ingredients/${created.id}`), { shopCategoryId: 'kat-iny' })
    expect(bad.status).toBe(400)
    expect((await send(app, 'PUT', api('/ingredients/ing-iny'), { name: 'X' })).status).toBe(404)
    const all = await (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()
    expect(all.map((i) => i.name)).toEqual(['Mrkva'])
  })

  it('hľadá ingrediencie bez diakritiky', async () => {
    await send(app, 'POST', api('/ingredients'), { name: 'Čučoriedky' })
    await send(app, 'POST', api('/ingredients'), { name: 'Mrkva' })
    const found = await (await send(app, 'GET', api('/ingredients?q=cucor'))).json<IngredientDto[]>()
    expect(found.map((i) => i.name)).toEqual(['Čučoriedky'])
  })
})
