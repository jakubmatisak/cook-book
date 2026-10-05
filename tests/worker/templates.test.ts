import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type {
  MeResponse,
  PlanEntryDto,
  RecipeDetailDto,
  TemplateApplyResult,
  WeekTemplateDto,
} from '@shared/api'
import { createApp } from '../../worker/app'
import { api, count, send } from './helpers'

const app = createApp()

const MON = '2026-10-05'
const NEXT_MON = '2026-10-12'

async function setup() {
  const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
  const slot = (name: string) => me.slots.find((s) => s.name === name)!.id
  const recipe = async (title: string) =>
    (await (await send(app, 'POST', api('/recipes'), { title, servings: 4 })).json<RecipeDetailDto>()).id
  const gulas = await recipe('Guláš')
  const rizoto = await recipe('Rizoto')
  const add = async (body: object) => {
    const res = await send(app, 'POST', api('/plan/entries'), body)
    expect(res.status).toBe(201)
    return res.json<PlanEntryDto>()
  }
  await add({ date: MON, slotId: slot('Obed'), recipeId: gulas })
  await add({ date: MON, slotId: slot('Večera'), freeText: 'Zvyšky' })
  await add({ date: '2026-10-07', slotId: slot('Obed'), recipeId: rizoto })
  return { slot, gulas, rizoto, add }
}

const week = async (from: string) => {
  const to = new Date(Date.parse(`${from}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10)
  const res = await send(app, 'GET', api(`/plan?from=${from}&to=${to}`))
  return res.json<PlanEntryDto[]>()
}
const titles = (entries: PlanEntryDto[]) => entries.map((e) => [e.date, e.recipe?.title ?? e.freeText])

const save = (name: string, fromDate = MON) => send(app, 'POST', api('/plan/templates'), { name, fromDate })
const apply = (id: string, body: object) => send(app, 'POST', api(`/plan/templates/${id}/apply`), body)

describe('šablóny týždňov', () => {
  it('uloží týždeň ako šablónu a vypíše ju s počtom jedál', async () => {
    await setup()
    const res = await save('Bežný týždeň')
    expect(res.status).toBe(201)
    const template = await res.json<WeekTemplateDto>()
    expect(template).toMatchObject({ name: 'Bežný týždeň', entryCount: 3 })

    const list = await (await send(app, 'GET', api('/plan/templates'))).json<WeekTemplateDto[]>()
    expect(list).toEqual([template])
  })

  it('prázdny týždeň a neplatný názov sa odmietnu', async () => {
    const empty = await save('Nič')
    expect(empty.status).toBe(400)
    expect((await empty.json<{ error: { code: string } }>()).error.code).toBe('empty_week')
    await setup()
    expect((await save('')).status).toBe(400)
    expect((await save('x'.repeat(61))).status).toBe(400)
    expect((await send(app, 'POST', api('/plan/templates'), { name: 'A', fromDate: 'nie' })).status).toBe(400)
  })

  it('použije šablónu na ďalší týždeň so zachovaním dní a jedál', async () => {
    await setup()
    const template = await (await save('Bežný týždeň')).json<WeekTemplateDto>()
    const res = await apply(template.id, { toDate: NEXT_MON })
    expect(res.status).toBe(200)
    expect(await res.json<TemplateApplyResult>()).toEqual({ applied: 3, skipped: 0 })
    expect(titles(await week(NEXT_MON))).toEqual([
      ['2026-10-12', 'Guláš'],
      ['2026-10-12', 'Zvyšky'],
      ['2026-10-14', 'Rizoto'],
    ])
    // pôvodný týždeň ostáva
    expect(await week(MON)).toHaveLength(3)
  })

  it('bez nahradenia jedlá pribudnú, s nahradením sa cieľový týždeň najprv vyprázdni', async () => {
    const { add, slot, gulas } = await setup()
    const template = await (await save('T')).json<WeekTemplateDto>()
    await add({ date: '2026-10-13', slotId: slot('Obed'), recipeId: gulas })
    await apply(template.id, { toDate: NEXT_MON })
    expect(await week(NEXT_MON)).toHaveLength(4)
    await apply(template.id, { toDate: NEXT_MON, replace: true })
    expect(titles(await week(NEXT_MON))).toEqual([
      ['2026-10-12', 'Guláš'],
      ['2026-10-12', 'Zvyšky'],
      ['2026-10-14', 'Rizoto'],
    ])
  })

  it('dni sa rátajú od zvoleného začiatku a zmazaný recept sa preskočí', async () => {
    const { gulas } = await setup()
    const template = await (await save('T')).json<WeekTemplateDto>()
    await send(app, 'DELETE', api(`/recipes/${gulas}`))
    const res = await apply(template.id, { toDate: '2026-10-14' })
    expect(await res.json<TemplateApplyResult>()).toEqual({ applied: 2, skipped: 1 })
    expect(titles(await week('2026-10-14'))).toEqual([
      ['2026-10-14', 'Zvyšky'],
      ['2026-10-16', 'Rizoto'],
    ])
  })

  it('zachová poradie viacerých jedál v jednom poli', async () => {
    const { add, slot } = await setup()
    await add({ date: MON, slotId: slot('Obed'), freeText: 'Polievka' })
    const template = await (await save('T')).json<WeekTemplateDto>()
    await apply(template.id, { toDate: NEXT_MON })
    const monday = (await week(NEXT_MON)).filter((e) => e.date === NEXT_MON && e.slotId === slot('Obed'))
    expect(monday.map((e) => e.recipe?.title ?? e.freeText)).toEqual(['Guláš', 'Polievka'])
  })

  it('šablóna je snímka: neskoršia zmena plánu ju nemení', async () => {
    const { add, slot } = await setup()
    const template = await (await save('T')).json<WeekTemplateDto>()
    await add({ date: MON, slotId: slot('Raňajky'), freeText: 'Kaša' })
    expect(await apply(template.id, { toDate: NEXT_MON }).then((r) => r.json<TemplateApplyResult>())).toEqual(
      {
        applied: 3,
        skipped: 0,
      },
    )
  })

  it('zmaže šablónu aj jej riadky; neexistujúca je 404', async () => {
    await setup()
    const template = await (await save('T')).json<WeekTemplateDto>()
    expect(await count('week_template_entries')).toBe(3)
    expect((await send(app, 'DELETE', api(`/plan/templates/${template.id}`))).status).toBe(204)
    expect(await count('week_template_entries')).toBe(0)
    expect((await send(app, 'DELETE', api(`/plan/templates/${template.id}`))).status).toBe(404)
    expect((await apply(template.id, { toDate: NEXT_MON })).status).toBe(404)
  })

  it('cudzia šablóna sa nevidí a nejde použiť ani zmazať', async () => {
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into week_templates (id, household_id, name, created_at, updated_at) values ('tpl-iny', 'iny', 'Cudzia', 'x', 'x')",
      ),
    ])
    expect(await (await send(app, 'GET', api('/plan/templates'))).json<WeekTemplateDto[]>()).toEqual([])
    expect((await apply('tpl-iny', { toDate: NEXT_MON })).status).toBe(404)
    expect((await send(app, 'DELETE', api('/plan/templates/tpl-iny'))).status).toBe(404)
  })
})
