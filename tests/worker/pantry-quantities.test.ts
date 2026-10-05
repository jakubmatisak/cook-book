import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type {
  ApiErrorBody,
  GenerateResult,
  IngredientDto,
  MeResponse,
  PantryDto,
  PantryItemDto,
  RecipeDetailDto,
  ShoppingItemDto,
  ShoppingListDto,
  StapleDto,
} from '@shared/api'
import { isStapleDue } from '@shared/shopping'
import { createApp } from '../../worker/app'
import { api, count, send } from './helpers'

const app = createApp()

const FROM = '2026-10-05'
const TO = '2026-10-11'

const pantry = async () => (await send(app, 'GET', api('/pantry'))).json<PantryDto>()
const ingredientId = async (name: string) =>
  (await (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()).find((i) => i.name === name)!
    .id

async function seed() {
  const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
  const recipe = await (
    await send(app, 'POST', api('/recipes'), {
      title: 'Palacinky',
      servings: 4,
      ingredients: [
        { name: 'Múka', quantity: 250, unit: 'g', isOptional: false },
        { name: 'Mlieko', quantity: 500, unit: 'ml', isOptional: false },
        { name: 'Vajcia', quantity: 3, unit: 'ks', isOptional: false },
      ],
    })
  ).json<RecipeDetailDto>()
  const slotId = me.slots.find((s) => s.name === 'Obed')!.id
  const lists = await (await send(app, 'GET', api('/shopping/lists'))).json<ShoppingListDto[]>()
  await send(app, 'POST', api('/plan/entries'), { date: FROM, slotId, recipeId: recipe.id })
  return { listId: lists[0]!.id }
}

const generate = async (listId: string) => {
  const res = await send(app, 'POST', api(`/shopping/lists/${listId}/generate`), { from: FROM, to: TO })
  expect(res.status).toBe(200)
  return res.json<GenerateResult>()
}
const items = async (listId: string) =>
  (await send(app, 'GET', api(`/shopping/lists/${listId}/items`))).json<ShoppingItemDto[]>()
const summary = (list: ShoppingItemDto[]) => list.map((i) => [i.name, i.quantity, i.unit, i.source])

describe('špajza s množstvom a trvanlivosťou', () => {
  it('uloží množstvo, jednotku, trvanlivosť a miesto a vráti ich s názvom', async () => {
    await seed()
    const muka = await ingredientId('Múka')
    const res = await send(app, 'PUT', api(`/pantry/${muka}`), {
      quantity: 1,
      unit: 'kg',
      expiresOn: '2026-12-31',
      location: 'Špajza',
    })
    expect(res.status).toBe(200)
    const saved = await res.json<PantryItemDto>()
    expect(saved).toMatchObject({
      ingredientId: muka,
      name: 'Múka',
      quantity: 1,
      unit: 'kg',
      expiresOn: '2026-12-31',
      location: 'Špajza',
    })
    const all = await pantry()
    expect(all.ingredientIds).toEqual([muka])
    expect(all.items).toEqual([saved])
  })

  it('opätovné uloženie upraví ten istý riadok a PUT bez tela nič neprepíše', async () => {
    await seed()
    const muka = await ingredientId('Múka')
    await send(app, 'PUT', api(`/pantry/${muka}`), { quantity: 1, unit: 'kg' })
    await send(app, 'PUT', api(`/pantry/${muka}`), { quantity: 2, unit: 'kg', expiresOn: '2027-01-01' })
    expect(await count('pantry_items')).toBe(1)
    expect((await send(app, 'PUT', api(`/pantry/${muka}`))).status).toBe(204)
    expect((await pantry()).items[0]).toMatchObject({ quantity: 2, unit: 'kg', expiresOn: '2027-01-01' })
  })

  it('odmietne neplatné údaje a bez množstva zahodí jednotku', async () => {
    await seed()
    const muka = await ingredientId('Múka')
    for (const body of [{ quantity: -1 }, { quantity: 0 }, { expiresOn: '31.12.2026' }, { unit: 'kvapka' }]) {
      const res = await send(app, 'PUT', api(`/pantry/${muka}`), body)
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect((await res.json<ApiErrorBody>()).error.code).toBe('validation_error')
    }
    const res = await send(app, 'PUT', api(`/pantry/${muka}`), { unit: 'kg' })
    expect((await res.json<PantryItemDto>()).unit).toBeNull()
    expect((await send(app, 'PUT', api(`/pantry/${muka}`), '{nie json')).status).toBe(400)
  })

  it('ingrediencia inej domácnosti sa nedá uložiť ani s množstvom', async () => {
    await seed()
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into ingredients (id, household_id, name, name_normalized, aliases, created_at, updated_at) values ('ing-iny', 'iny', 'Soľ', 'sol', '[]', 'x', 'x')",
      ),
    ])
    expect((await send(app, 'PUT', api('/pantry/ing-iny'), { quantity: 1, unit: 'kg' })).status).toBe(404)
  })
})

describe('stále položky', () => {
  const create = (body: object) => send(app, 'POST', api('/staples'), body)

  it('vytvorí, vypíše, upraví a zmaže stálu položku; chýbajúcu ingredienciu založí', async () => {
    const res = await create({ name: 'Chlieb', quantity: 1, unit: 'ks', everyNWeeks: 1 })
    expect(res.status).toBe(201)
    const staple = await res.json<StapleDto>()
    expect(staple).toMatchObject({ name: 'Chlieb', quantity: 1, unit: 'ks', everyNWeeks: 1 })
    expect(await count('ingredients')).toBe(1)

    const updated = await send(app, 'PUT', api(`/staples/${staple.id}`), {
      quantity: 2,
      unit: 'ks',
      everyNWeeks: 2,
    })
    expect(await updated.json<StapleDto>()).toMatchObject({ id: staple.id, quantity: 2, everyNWeeks: 2 })

    const list = await (await send(app, 'GET', api('/staples'))).json<StapleDto[]>()
    expect(list.map((s) => [s.name, s.quantity, s.everyNWeeks])).toEqual([['Chlieb', 2, 2]])

    expect((await send(app, 'DELETE', api(`/staples/${staple.id}`))).status).toBe(204)
    expect(await (await send(app, 'GET', api('/staples'))).json<StapleDto[]>()).toEqual([])
    expect((await send(app, 'DELETE', api(`/staples/${staple.id}`))).status).toBe(404)
  })

  it('použije existujúcu ingredienciu bez ohľadu na diakritiku a veľkosť písmen', async () => {
    await seed()
    const before = await count('ingredients')
    const staple = await (await create({ name: 'MLIEKO', quantity: 1, unit: 'l' })).json<StapleDto>()
    expect(staple.ingredientId).toBe(await ingredientId('Mlieko'))
    expect(await count('ingredients')).toBe(before)
  })

  it('odmietne neplatné údaje', async () => {
    for (const body of [
      { name: '' },
      { name: 'Mlieko', everyNWeeks: 0 },
      { name: 'Mlieko', everyNWeeks: 99 },
      { name: 'Mlieko', quantity: -1 },
    ]) {
      expect((await create(body)).status, JSON.stringify(body)).toBe(400)
    }
  })

  it('cudziu stálu položku nevidno ani nejde upraviť', async () => {
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into ingredients (id, household_id, name, name_normalized, aliases, created_at, updated_at) values ('ing-iny', 'iny', 'Soľ', 'sol', '[]', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into staple_items (id, household_id, ingredient_id, every_n_weeks, created_at, updated_at) values ('st-iny', 'iny', 'ing-iny', 1, 'x', 'x')",
      ),
    ])
    expect(await (await send(app, 'GET', api('/staples'))).json<StapleDto[]>()).toEqual([])
    expect((await send(app, 'PUT', api('/staples/st-iny'), { everyNWeeks: 2 })).status).toBe(404)
    expect((await send(app, 'DELETE', api('/staples/st-iny'))).status).toBe(404)
  })
})

describe('nákup s odpočtom špajze a stálymi položkami', () => {
  it('odpočíta zásoby, pokryté vynechá a výsledok oznámi', async () => {
    const { listId } = await seed()
    // Múka: v špajzi 100 g z 250 g → ostane 150 g; Mlieko: 1 l pokryje 500 ml; Vajcia bez zásoby.
    await send(app, 'PUT', api(`/pantry/${await ingredientId('Múka')}`), { quantity: 100, unit: 'g' })
    await send(app, 'PUT', api(`/pantry/${await ingredientId('Mlieko')}`), { quantity: 1, unit: 'l' })

    const result = await generate(listId)
    expect(result).toMatchObject({ added: 2, covered: ['Mlieko'], reduced: ['Múka'], staples: 0 })
    expect(summary(await items(listId))).toEqual([
      ['Múka', 150, 'g', 'generated'],
      ['Vajcia', 3, 'ks', 'generated'],
    ])
  })

  it('exspirovaná zásoba sa nepočíta', async () => {
    const { listId } = await seed()
    await send(app, 'PUT', api(`/pantry/${await ingredientId('Mlieko')}`), {
      quantity: 1,
      unit: 'l',
      expiresOn: '2026-10-01',
    })
    await generate(listId)
    expect((await items(listId)).find((i) => i.name === 'Mlieko')).toMatchObject({
      quantity: 500,
      unit: 'ml',
    })
  })

  it('položka špajze bez množstva pokryje ingredienciu celú', async () => {
    const { listId } = await seed()
    await send(app, 'PUT', api(`/pantry/${await ingredientId('Vajcia')}`))
    await generate(listId)
    expect((await items(listId)).map((i) => i.name)).toEqual(['Mlieko', 'Múka'])
  })

  it('pridá stále položky na rade s pôvodom „staple“ a pri opakovaní ich nezdvojí', async () => {
    const { listId } = await seed()
    await send(app, 'POST', api('/staples'), { name: 'Chlieb', quantity: 1, unit: 'ks', everyNWeeks: 1 })
    await send(app, 'POST', api('/staples'), { name: 'Mlieko', quantity: 2, unit: 'l', everyNWeeks: 1 })

    const first = await generate(listId)
    expect(first.staples).toBe(2)
    const list = await items(listId)
    expect(summary(list)).toEqual([
      ['Chlieb', 1, 'ks', 'staple'],
      ['Mlieko', 500, 'ml', 'generated'],
      ['Mlieko', 2000, 'ml', 'staple'],
      ['Múka', 250, 'g', 'generated'],
      ['Vajcia', 3, 'ks', 'generated'],
    ])
    expect(list.find((i) => i.source === 'staple')!.sources).toEqual([])

    const second = await generate(listId)
    expect(second).toMatchObject({ staples: 2, removed: 5 })
    expect(await items(listId)).toHaveLength(5)
  })

  it('stála položka mimo rytmu sa nepridá', async () => {
    const { listId } = await seed()
    // Rytmus 2 týždne: práve jeden z dvoch po sebe idúcich týždňov je na rade.
    const week2 = '2026-10-12'
    const dueNow = isStapleDue(2, FROM)
    await send(app, 'POST', api('/staples'), { name: 'Pivo', quantity: 6, unit: 'ks', everyNWeeks: 2 })
    const first = await generate(listId)
    expect(first.staples).toBe(dueNow ? 1 : 0)
    const next = await send(app, 'POST', api(`/shopping/lists/${listId}/generate`), {
      from: week2,
      to: '2026-10-18',
    })
    expect((await next.json<GenerateResult>()).staples).toBe(isStapleDue(2, week2) ? 1 : 0)
  })

  it('kúpená stála položka sa pri ďalšom generovaní nepridá znova', async () => {
    const { listId } = await seed()
    await send(app, 'POST', api('/staples'), { name: 'Chlieb', quantity: 1, unit: 'ks', everyNWeeks: 1 })
    await generate(listId)
    const bread = (await items(listId)).find((i) => i.name === 'Chlieb')!
    await send(app, 'PATCH', api(`/shopping/items/${bread.id}`), { isChecked: true })
    const again = await generate(listId)
    expect(again.staples).toBe(0)
    expect((await items(listId)).filter((i) => i.name === 'Chlieb')).toHaveLength(1)
  })

  it('špajza pokrýva aj stálu položku', async () => {
    const { listId } = await seed()
    await send(app, 'POST', api('/staples'), { name: 'Chlieb', quantity: 1, unit: 'ks', everyNWeeks: 1 })
    await send(app, 'PUT', api(`/pantry/${await ingredientId('Chlieb')}`), { quantity: 2, unit: 'ks' })
    const result = await generate(listId)
    expect(result.staples).toBe(0)
    expect((await items(listId)).some((i) => i.name === 'Chlieb')).toBe(false)
  })
})

describe('opakovanie stálych položiek v ďalších týždňoch', () => {
  it('kúpená stála položka z minulého týždňa nebráni jej pridaniu v ďalšom', async () => {
    const { listId } = await seed()
    await send(app, 'POST', api('/staples'), { name: 'Chlieb', quantity: 1, unit: 'ks', everyNWeeks: 1 })
    await generate(listId)
    const bread = (await items(listId)).find((i) => i.name === 'Chlieb')!
    await send(app, 'PATCH', api(`/shopping/items/${bread.id}`), { isChecked: true })

    const next = await send(app, 'POST', api(`/shopping/lists/${listId}/generate`), {
      from: '2026-10-12',
      to: '2026-10-18',
    })
    expect((await next.json<GenerateResult>()).staples).toBe(1)
    const breads = (await items(listId)).filter((i) => i.name === 'Chlieb')
    expect(breads.map((b) => b.isChecked).sort()).toEqual([false, true])
  })
})
