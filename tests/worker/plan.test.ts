import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { MeResponse, PlanCopyResult, PlanEntryDto, RecipeDetailDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

async function setup() {
  const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
  const slot = (name: string) => me.slots.find((s) => s.name === name)!.id
  const recipe = await (
    await send(app, 'POST', api('/recipes'), { title: 'Guláš', servings: 4 })
  ).json<RecipeDetailDto>()
  return { obed: slot('Obed'), vecera: slot('Večera'), ranajky: slot('Raňajky'), recipe }
}

async function addEntry(body: object) {
  const res = await send(app, 'POST', api('/plan/entries'), body)
  expect(res.status).toBe(201)
  return res.json<PlanEntryDto>()
}

const week = async (from: string, to: string) => {
  const res = await send(app, 'GET', api(`/plan?from=${from}&to=${to}`))
  expect(res.status).toBe(200)
  return res.json<PlanEntryDto[]>()
}

describe('jedálniček – záznamy', () => {
  it('naplánuje recept aj voľný text a vráti ich zoradené', async () => {
    const { obed, vecera, ranajky, recipe } = await setup()
    await addEntry({ date: '2026-10-06', slotId: vecera, freeText: 'Zvyšky' })
    const gulas = await addEntry({
      date: '2026-10-05',
      slotId: obed,
      recipeId: recipe.id,
      servingsOverride: 6,
    })
    await addEntry({ date: '2026-10-06', slotId: ranajky, freeText: 'Kaša', note: 's ovocím' })

    expect(gulas).toMatchObject({
      date: '2026-10-05',
      recipe: { id: recipe.id, title: 'Guláš', servings: 4, deleted: false },
      servingsOverride: 6,
      audience: 'all',
    })
    const entries = await week('2026-10-05', '2026-10-11')
    expect(entries.map((e) => [e.date, e.recipe?.title ?? e.freeText])).toEqual([
      ['2026-10-05', 'Guláš'],
      ['2026-10-06', 'Kaša'],
      ['2026-10-06', 'Zvyšky'],
    ])
    expect(await week('2026-10-12', '2026-10-18')).toEqual([])
  })

  it('odmietne záznam bez obsahu, s cudzím slotom, cudzím alebo zmazaným receptom', async () => {
    const { obed, recipe } = await setup()
    expect((await send(app, 'POST', api('/plan/entries'), { date: '2026-10-05', slotId: obed })).status).toBe(
      400,
    )
    expect(
      (await send(app, 'POST', api('/plan/entries'), { date: '2026-10-05', slotId: 'cudzi', freeText: 'x' }))
        .status,
    ).toBe(400)
    expect(
      (await send(app, 'POST', api('/plan/entries'), { date: '2026-10-05', slotId: obed, recipeId: 'cudzi' }))
        .status,
    ).toBe(400)
    await send(app, 'DELETE', api(`/recipes/${recipe.id}`))
    expect(
      (
        await send(app, 'POST', api('/plan/entries'), {
          date: '2026-10-05',
          slotId: obed,
          recipeId: recipe.id,
        })
      ).status,
    ).toBe(400)
  })

  it('zmazanie receptu odstráni jeho záznamy z jedálnička, ručné záznamy ostanú', async () => {
    const { obed, vecera, recipe } = await setup()
    await addEntry({ date: '2026-10-05', slotId: obed, recipeId: recipe.id })
    await addEntry({ date: '2026-10-06', slotId: vecera, recipeId: recipe.id, servingsOverride: 2 })
    await addEntry({ date: '2026-10-05', slotId: vecera, freeText: 'Zvyšky' })
    const other = await (
      await send(app, 'POST', api('/recipes'), { title: 'Palacinky', servings: 2 })
    ).json<RecipeDetailDto>()
    await addEntry({ date: '2026-10-07', slotId: obed, recipeId: other.id })

    expect((await send(app, 'DELETE', api(`/recipes/${recipe.id}`))).status).toBe(204)

    const entries = await week('2026-10-05', '2026-10-11')
    expect(entries.map((e) => e.recipe?.title ?? e.freeText)).toEqual(['Zvyšky', 'Palacinky'])
  })

  it('záznam naviazaný na už zmazaný recept sa v jedálničku nezobrazuje', async () => {
    const { obed, vecera, recipe } = await setup()
    await addEntry({ date: '2026-10-05', slotId: obed, recipeId: recipe.id })
    await addEntry({ date: '2026-10-05', slotId: vecera, freeText: 'Zvyšky' })
    // stav spred opravy: recept zmazaný, záznam v pláne ostal
    await env.DB.prepare("update recipes set deleted_at = '2026-10-06T00:00:00.000Z'").run()
    const entries = await week('2026-10-05', '2026-10-05')
    expect(entries.map((e) => e.freeText)).toEqual(['Zvyšky'])
  })

  it('záznam obsahuje typ jedla receptu', async () => {
    const { obed, recipe } = await setup()
    const entry = await addEntry({ date: '2026-10-05', slotId: obed, recipeId: recipe.id })
    expect(entry.recipe).toMatchObject({ category: 'hlavne' })
  })

  it('presunie záznam na iný deň a slot a zmaže ho', async () => {
    const { obed, vecera, recipe } = await setup()
    const entry = await addEntry({ date: '2026-10-05', slotId: obed, recipeId: recipe.id })
    const res = await send(app, 'PUT', api(`/plan/entries/${entry.id}`), {
      date: '2026-10-07',
      slotId: vecera,
      recipeId: recipe.id,
      note: 'presunuté',
    })
    expect(res.status).toBe(200)
    expect(await res.json<PlanEntryDto>()).toMatchObject({
      date: '2026-10-07',
      slotId: vecera,
      note: 'presunuté',
    })
    expect((await send(app, 'DELETE', api(`/plan/entries/${entry.id}`))).status).toBe(204)
    expect(await week('2026-10-05', '2026-10-11')).toEqual([])
  })

  it('neplatný alebo príliš dlhý rozsah je 400', async () => {
    await setup()
    expect((await send(app, 'GET', api('/plan?from=2026-10-05&to=2026-12-31'))).status).toBe(400)
    expect((await send(app, 'GET', api('/plan?from=x&to=2026-10-05'))).status).toBe(400)
  })
})

describe('jedálniček – kopírovanie', () => {
  it('skopíruje týždeň s posunom dátumov a zachová sloty', async () => {
    const { obed, vecera, recipe } = await setup()
    await addEntry({ date: '2026-10-05', slotId: obed, recipeId: recipe.id, servingsOverride: 3 })
    await addEntry({ date: '2026-10-11', slotId: vecera, freeText: 'Pizza' })
    await addEntry({ date: '2026-10-12', slotId: obed, freeText: 'Mimo rozsahu' })

    const res = await send(app, 'POST', api('/plan/copy'), { fromDate: '2026-10-05', toDate: '2026-10-12' })
    expect(res.status).toBe(200)
    expect(await res.json<PlanCopyResult>()).toEqual({ copied: 2 })

    const next = await week('2026-10-12', '2026-10-18')
    expect(next.map((e) => [e.date, e.slotId, e.recipe?.title ?? e.freeText, e.servingsOverride])).toEqual([
      ['2026-10-12', obed, 'Mimo rozsahu', null],
      ['2026-10-12', obed, 'Guláš', 3],
      ['2026-10-18', vecera, 'Pizza', null],
    ])
  })

  it('opakované kopírovanie zdvojí jedlá, s nahradením nie', async () => {
    const { obed } = await setup()
    await addEntry({ date: '2026-10-05', slotId: obed, freeText: 'Rizoto' })
    const copy = (replace: boolean) =>
      send(app, 'POST', api('/plan/copy'), { fromDate: '2026-10-05', toDate: '2026-10-12', replace })
    await copy(false)
    await copy(false)
    expect(await week('2026-10-12', '2026-10-18')).toHaveLength(2)
    await copy(true)
    expect(await week('2026-10-12', '2026-10-18')).toHaveLength(1)
  })

  it('kopírovanie nepreskočí zmazaný recept a nekopíruje dáta inej domácnosti', async () => {
    const { obed, recipe } = await setup()
    await addEntry({ date: '2026-10-05', slotId: obed, recipeId: recipe.id })
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into meal_slots (id, household_id, name, sort_order, is_enabled, created_at, updated_at) values ('s-iny', 'iny', 'Obed', 0, 1, 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into meal_plan_entries (id, household_id, date, slot_id, free_text, sort_order, audience, created_at, updated_at) values ('e-iny', 'iny', '2026-10-06', 's-iny', 'Cudzie', 0, 'all', 'x', 'x')",
      ),
    ])
    const res = await send(app, 'POST', api('/plan/copy'), { fromDate: '2026-10-05', toDate: '2026-10-12' })
    expect(await res.json<PlanCopyResult>()).toEqual({ copied: 1 })
    expect((await week('2026-10-05', '2026-10-11')).map((e) => e.id)).not.toContain('e-iny')
    expect(
      (
        await send(app, 'PUT', api('/plan/entries/e-iny'), {
          date: '2026-10-06',
          slotId: obed,
          freeText: 'x',
        })
      ).status,
    ).toBe(404)
    expect((await send(app, 'DELETE', api('/plan/entries/e-iny'))).status).toBe(404)
  })
})

describe('jedálniček – veľké týždne', () => {
  it('kopírovanie s nahradením zvládne 120 jedál (limit parametrov D1)', async () => {
    const { obed } = await setup()
    const rows = Array.from({ length: 120 }, (_, i) =>
      env.DB.prepare(
        "insert into meal_plan_entries (id, household_id, date, slot_id, free_text, sort_order, audience, created_at, updated_at) values (?, 'default', ?, ?, ?, ?, 'all', 'x', 'x')",
      ).bind(`e${i}`, `2026-10-0${5 + (i % 5)}`, obed, `Jedlo ${i}`, i),
    )
    await env.DB.batch(rows)
    const res = await send(app, 'POST', api('/plan/copy'), {
      fromDate: '2026-10-05',
      toDate: '2026-10-12',
      replace: true,
    })
    expect(res.status).toBe(200)
    expect(await res.json<PlanCopyResult>()).toEqual({ copied: 120 })
  })
})
