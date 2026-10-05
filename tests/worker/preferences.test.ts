import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type {
  FamilyMemberDto,
  IngredientDto,
  MeResponse,
  PlanEntryDto,
  RecipeDetailDto,
  TagDto,
} from '@shared/api'
import { createApp } from '../../worker/app'
import { api, count, send } from './helpers'

const app = createApp()

const DAY = '2026-10-05'

async function setup() {
  const member = async (name: string, kind: 'adult' | 'child') =>
    (await (await send(app, 'POST', api('/members'), { name, kind })).json<FamilyMemberDto>()).id
  const mama = await member('Mama', 'adult')
  const ema = await member('Ema', 'child')
  const recipe = async (title: string, ingredients: string[], tags: string[] = []) =>
    (
      await (
        await send(app, 'POST', api('/recipes'), {
          title,
          servings: 4,
          tags,
          ingredients: ingredients.map((name) => ({ name, quantity: 1, unit: 'ks', isOptional: false })),
        })
      ).json<RecipeDetailDto>()
    ).id
  const svadzbovy = await recipe('Orechový koláč', ['Orechy', 'Múka'], ['Dezert'])
  const huby = await recipe('Hubová omáčka', ['Huby', 'Smotana'], ['Vegetariánske'])
  const guláš = await recipe('Guláš', ['Hovädzie', 'Cibuľa'])
  const ingredients = await (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()
  const tags = await (await send(app, 'GET', api('/tags'))).json<TagDto[]>()
  const ing = (name: string) => ingredients.find((i) => i.name === name)!.id
  const tag = (name: string) => tags.find((t) => t.name === name)!.id
  const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
  const slotId = me.slots.find((s) => s.name === 'Obed')!.id
  return { mama, ema, svadzbovy, huby, guláš, ing, tag, slotId }
}

const setPrefs = (memberId: string, body: object) =>
  send(app, 'PUT', api(`/members/${memberId}/preferences`), body)

const members = async () => (await send(app, 'GET', api('/members'))).json<FamilyMemberDto[]>()
const plan = async () => (await send(app, 'GET', api(`/plan?from=${DAY}&to=${DAY}`))).json<PlanEntryDto[]>()

describe('preferencie členov rodiny', () => {
  it('uloží alergie, averzie a diéty a vráti ich s názvami', async () => {
    const { mama, ing, tag } = await setup()
    const res = await setPrefs(mama, {
      allergies: [ing('Orechy')],
      dislikes: [ing('Huby')],
      diets: [tag('Vegetariánske')],
    })
    expect(res.status).toBe(200)
    const saved = await res.json<FamilyMemberDto>()
    expect(saved.preferences.map((p) => [p.kind, p.label])).toEqual([
      ['allergy', 'Orechy'],
      ['dislike', 'Huby'],
      ['diet', 'Vegetariánske'],
    ])
    const listed = (await members()).find((m) => m.id === mama)!
    expect(listed.preferences).toEqual(saved.preferences)
    const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
    expect(me.members.find((m) => m.id === mama)!.preferences).toHaveLength(3)
  })

  it('nové uloženie nahradí staré a prázdne zoznamy preferencie zmažú', async () => {
    const { mama, ing } = await setup()
    await setPrefs(mama, { allergies: [ing('Orechy'), ing('Huby')] })
    await setPrefs(mama, { allergies: [ing('Huby')] })
    expect((await members()).find((m) => m.id === mama)!.preferences.map((p) => p.label)).toEqual(['Huby'])
    await setPrefs(mama, {})
    expect((await members()).find((m) => m.id === mama)!.preferences).toEqual([])
    expect(await count('member_preferences')).toBe(0)
  })

  it('alergia má prednosť pred averziou na tú istú ingredienciu a duplicity sa spoja', async () => {
    const { mama, ing } = await setup()
    const res = await setPrefs(mama, {
      allergies: [ing('Orechy'), ing('Orechy')],
      dislikes: [ing('Orechy'), ing('Huby'), ing('Huby')],
    })
    expect((await res.json<FamilyMemberDto>()).preferences.map((p) => [p.kind, p.label])).toEqual([
      ['allergy', 'Orechy'],
      ['dislike', 'Huby'],
    ])
  })

  it('odmietne neexistujúcu alebo cudziu ingredienciu a tag', async () => {
    const { mama, ing } = await setup()
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into ingredients (id, household_id, name, name_normalized, aliases, created_at, updated_at) values ('ing-iny', 'iny', 'Soľ', 'sol', '[]', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into tags (id, household_id, name, created_at, updated_at) values ('tag-iny', 'iny', 'Cudzí', 'x', 'x')",
      ),
    ])
    for (const body of [
      { allergies: ['neexistuje'] },
      { dislikes: ['ing-iny'] },
      { diets: ['tag-iny'] },
      { allergies: [ing('Orechy'), 'ing-iny'] },
    ]) {
      const res = await setPrefs(mama, body)
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect((await res.json<{ error: { code: string } }>()).error.code).toBe('invalid_preference')
    }
    // nič sa čiastočne neuložilo
    expect(await count('member_preferences')).toBe(0)
  })

  it('neplatné telo je 400 a cudzí alebo neexistujúci člen 404', async () => {
    const { mama } = await setup()
    expect((await setPrefs(mama, { allergies: 'orechy' })).status).toBe(400)
    expect((await setPrefs(mama, { allergies: Array.from({ length: 51 }, (_, i) => `i${i}`) })).status).toBe(
      400,
    )
    expect((await setPrefs('neexistuje', {})).status).toBe(404)
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into family_members (id, household_id, name, kind, portion_factor, is_active, sort_order, created_at, updated_at) values ('m-iny', 'iny', 'Cudzí', 'adult', 1, 1, 0, 'x', 'x')",
      ),
    ])
    expect((await setPrefs('m-iny', {})).status).toBe(404)
  })

  it('zmazanie člena zmaže aj jeho preferencie', async () => {
    const { mama, ing } = await setup()
    await setPrefs(mama, { allergies: [ing('Orechy')] })
    await send(app, 'DELETE', api(`/members/${mama}`))
    expect(await count('member_preferences')).toBe(0)
  })

  it('člen bez preferencií má prázdny zoznam, aj hneď po vytvorení a úprave', async () => {
    const created = await (
      await send(app, 'POST', api('/members'), { name: 'Tato', kind: 'adult' })
    ).json<FamilyMemberDto>()
    expect(created.preferences).toEqual([])
    const updated = await (
      await send(app, 'PUT', api(`/members/${created.id}`), { name: 'Tatko', kind: 'adult' })
    ).json<FamilyMemberDto>()
    expect(updated.preferences).toEqual([])
  })
})

describe('upozornenia v jedálničku', () => {
  const addEntry = async (recipeId: string, slotId: string, audience?: string) => {
    const res = await send(app, 'POST', api('/plan/entries'), { date: DAY, slotId, recipeId })
    expect(res.status).toBe(201)
    const entry = await res.json<PlanEntryDto>()
    if (!audience) return entry
    await env.DB.prepare('update meal_plan_entries set audience = ? where id = ?')
      .bind(audience, entry.id)
      .run()
    return (await plan()).find((e) => e.id === entry.id)!
  }

  it('pri alergii, averzii a diéte vráti upozornenia už pri vytvorení záznamu aj v zozname', async () => {
    const { mama, ema, svadzbovy, huby, ing, tag, slotId } = await setup()
    await setPrefs(mama, { allergies: [ing('Orechy')], diets: [tag('Vegetariánske')] })
    await setPrefs(ema, { dislikes: [ing('Huby')] })

    const koláč = await addEntry(svadzbovy, slotId)
    expect(koláč.warnings.map((w) => [w.memberName, w.kind, w.label])).toEqual([
      ['Mama', 'allergy', 'Orechy'],
      ['Mama', 'diet', 'Vegetariánske'],
    ])
    const omáčka = await addEntry(huby, slotId)
    expect(omáčka.warnings.map((w) => [w.memberName, w.kind, w.label])).toEqual([['Ema', 'dislike', 'Huby']])

    const listed = await plan()
    expect(listed.find((e) => e.id === koláč.id)!.warnings).toEqual(koláč.warnings)
    expect(listed.find((e) => e.id === omáčka.id)!.warnings).toEqual(omáčka.warnings)
  })

  it('jedlo bez konfliktu, voľný text a rodina bez preferencií nemajú upozornenia', async () => {
    const { mama, guláš, svadzbovy, ing, slotId } = await setup()
    expect((await addEntry(svadzbovy, slotId)).warnings).toEqual([])
    await setPrefs(mama, { allergies: [ing('Orechy')] })
    expect((await addEntry(guláš, slotId)).warnings).toEqual([])
    const free = await (
      await send(app, 'POST', api('/plan/entries'), { date: DAY, slotId, freeText: 'Zvyšky' })
    ).json<PlanEntryDto>()
    expect(free.warnings).toEqual([])
  })

  it('cieľová skupina určuje, koho sa upozornenie týka, a neaktívny člen sa vynechá', async () => {
    const { mama, ema, svadzbovy, ing, slotId } = await setup()
    await setPrefs(mama, { allergies: [ing('Orechy')] })
    await setPrefs(ema, { allergies: [ing('Orechy')] })
    expect((await addEntry(svadzbovy, slotId, 'adults')).warnings.map((w) => w.memberName)).toEqual(['Mama'])
    expect((await addEntry(svadzbovy, slotId, 'children')).warnings.map((w) => w.memberName)).toEqual(['Ema'])

    await send(app, 'PUT', api(`/members/${ema}`), { name: 'Ema', kind: 'child', isActive: false })
    expect((await addEntry(svadzbovy, slotId)).warnings.map((w) => w.memberName)).toEqual(['Mama'])
  })

  it('upozornenie sa aktualizuje po zmene receptu v zázname', async () => {
    const { mama, svadzbovy, guláš, ing, slotId } = await setup()
    await setPrefs(mama, { allergies: [ing('Orechy')] })
    const entry = await addEntry(svadzbovy, slotId)
    expect(entry.warnings).toHaveLength(1)
    const res = await send(app, 'PUT', api(`/plan/entries/${entry.id}`), {
      date: DAY,
      slotId,
      recipeId: guláš,
    })
    expect((await res.json<PlanEntryDto>()).warnings).toEqual([])
  })
})
