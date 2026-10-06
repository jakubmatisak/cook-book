import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type {
  ApiErrorBody,
  FamilyMemberDto,
  GenerateResult,
  GuestStayDto,
  IngredientDto,
  MeResponse,
  PlanEntryDto,
  RecipeDetailDto,
  ShoppingItemDto,
  ShoppingListDto,
} from '@shared/api'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { createHousehold, ensureUser } from '../../worker/services/household'
import { inviteMember } from '../../worker/services/memberships'
import { api, send } from './helpers'

const app = createApp()
const OWNER = 'ja@example.com'
const MEMBER = 'clen@example.com'
const as = (email: string) => ({ as: email })

async function setup() {
  const owner = await ensureUser(getDb(env), OWNER)
  await inviteMember(getDb(env), owner.householdId, MEMBER, 'member')
  const me = await (await send(app, 'GET', api('/me'), undefined, as(OWNER))).json<MeResponse>()
  const make = async (name: string, kind: string) =>
    (await (await send(app, 'POST', api('/members'), { name, kind }, as(OWNER))).json()) as FamilyMemberDto
  const adult = await make('Mama', 'adult')
  const guest = await make('Teta Eva', 'guest')
  const recipe = await (
    await send(
      app,
      'POST',
      api('/recipes'),
      {
        title: 'Orechová torta',
        servings: 2,
        ingredients: [{ name: 'Orechy', quantity: 200, unit: 'g' }],
      },
      as(OWNER),
    )
  ).json<RecipeDetailDto>()
  return { obed: me.slots.find((s) => s.name === 'Obed')!.id, adult, guest, recipe }
}

const addStay = (memberIds: string | string[], fromDate: string, toDate: string, by = OWNER) =>
  send(app, 'POST', api('/plan/stays'), { memberIds: [memberIds].flat(), fromDate, toDate }, as(by))
const stays = async (from = '2026-10-01', to = '2026-10-31') =>
  (await (
    await send(app, 'GET', api(`/plan/stays?from=${from}&to=${to}`), undefined, as(OWNER))
  ).json()) as GuestStayDto[]
const addEntry = (body: object) => send(app, 'POST', api('/plan/entries'), body, as(OWNER))
const week = async () =>
  (await (
    await send(app, 'GET', api('/plan?from=2026-10-05&to=2026-10-11'), undefined, as(OWNER))
  ).json()) as PlanEntryDto[]

describe('pobyt návštevy', () => {
  it('vytvorí pobyt a zobrazí ho v prekrývajúcom sa rozsahu', async () => {
    const { guest } = await setup()
    const res = await addStay(guest.id, '2026-10-06', '2026-10-08')
    expect(res.status).toBe(201)
    expect((await res.json<GuestStayDto[]>())[0]).toMatchObject({
      memberId: guest.id,
      fromDate: '2026-10-06',
      toDate: '2026-10-08',
    })
    expect(await stays('2026-10-05', '2026-10-11')).toHaveLength(1)
    expect(await stays('2026-10-08', '2026-10-20')).toHaveLength(1) // prekrýva sa v jeden deň
    expect(await stays('2026-10-09', '2026-10-20')).toEqual([])
    expect(await stays('2026-09-01', '2026-10-05')).toEqual([])
  })

  it('pobyt sa dá založiť naraz pre viacerých členov návštevy, bez duplicít', async () => {
    const { guest } = await setup()
    const uncle = (await (
      await send(app, 'POST', api('/members'), { name: 'Strýko Peter', kind: 'guest' }, as(OWNER))
    ).json()) as FamilyMemberDto
    const res = await addStay([guest.id, uncle.id, guest.id], '2026-10-06', '2026-10-08')
    expect(res.status).toBe(201)
    const created = await res.json<GuestStayDto[]>()
    expect(created.map((s) => s.memberId).sort()).toEqual([guest.id, uncle.id].sort())
    expect(await stays()).toHaveLength(2)
    // jeden neplatný člen zruší celé zadanie (nič sa neuloží)
    expect((await addStay([guest.id, 'neexistuje'], '2026-10-10', '2026-10-11')).status).toBe(400)
    expect(await stays('2026-10-10', '2026-10-11')).toEqual([])
    expect((await addStay([], '2026-10-10', '2026-10-11')).status).toBe(400)
  })

  it('pobyt vie vytvoriť aj člen domácnosti, nielen vlastník (plánovanie je pre všetkých)', async () => {
    const { guest } = await setup()
    expect((await addStay(guest.id, '2026-10-06', '2026-10-07', MEMBER)).status).toBe(201)
  })

  it('platí len pre návštevu z vlastnej domácnosti a pre rozumný rozsah', async () => {
    const { adult, guest } = await setup()
    const notGuest = await addStay(adult.id, '2026-10-06', '2026-10-07')
    expect(notGuest.status).toBe(400)
    expect((await notGuest.json<ApiErrorBody>()).error.code).toBe('invalid_guest')
    expect((await addStay('neexistuje', '2026-10-06', '2026-10-07')).status).toBe(400)
    expect((await addStay(guest.id, '2026-10-08', '2026-10-06')).status).toBe(400) // od > do
    expect((await addStay(guest.id, '2026-10-01', '2027-03-01')).status).toBe(400) // príliš dlhé
    expect((await addStay(guest.id, 'zle', '2026-10-06')).status).toBe(400)

    const other = await createHousehold(getDb(env), 'Rodičia')
    const foreign = await send(
      app,
      'POST',
      api(`/plan/stays?h=${other}`),
      { memberIds: [guest.id], fromDate: '2026-10-06', toDate: '2026-10-07' },
      as(OWNER),
    )
    expect([400, 403]).toContain(foreign.status)
  })

  it('pobyt sa dá zmazať a zmazanie návštevy z Rodiny zmaže aj jej pobyty', async () => {
    const { guest } = await setup()
    const [created] = await (await addStay(guest.id, '2026-10-06', '2026-10-08')).json<GuestStayDto[]>()
    expect((await send(app, 'DELETE', api(`/plan/stays/${created!.id}`), undefined, as(OWNER))).status).toBe(
      204,
    )
    expect(await stays()).toEqual([])
    expect((await send(app, 'DELETE', api(`/plan/stays/${created!.id}`), undefined, as(OWNER))).status).toBe(
      404,
    )

    await addStay(guest.id, '2026-10-06', '2026-10-08')
    await send(app, 'DELETE', api(`/members/${guest.id}`), undefined, as(OWNER))
    expect(await stays()).toEqual([])
  })
})

describe('pobyt návštevy v jedálničku', () => {
  it('jedlá v dňoch pobytu majú návštevu medzi prítomnými, ostatné nie', async () => {
    const { obed, guest, recipe } = await setup()
    await addStay(guest.id, '2026-10-06', '2026-10-07')
    for (const date of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']) {
      await addEntry({ date, slotId: obed, recipeId: recipe.id })
    }
    const entries = await week()
    expect(entries.map((e) => e.presentGuestIds)).toEqual([[], [guest.id], [guest.id], []])
    // výber pri jedle ostáva samostatný (len ručne vybrané)
    expect(entries.map((e) => e.guestIds)).toEqual([[], [], [], []])
  })

  it('ručne vybraná návšteva a pobyt sa nezdvoja', async () => {
    const { obed, guest, recipe } = await setup()
    await addStay(guest.id, '2026-10-06', '2026-10-06')
    await addEntry({ date: '2026-10-06', slotId: obed, recipeId: recipe.id, guestIds: [guest.id] })
    const [entry] = (await week()).filter((e) => e.date === '2026-10-06')
    expect(entry!.guestIds).toEqual([guest.id])
    expect(entry!.presentGuestIds).toEqual([guest.id])
  })

  it('alergia návštevy upozorní na jedlách v dňoch pobytu', async () => {
    const { obed, guest, recipe } = await setup()
    const orechy = (
      await (
        await send(app, 'GET', api('/ingredients?q=orech'), undefined, as(OWNER))
      ).json<IngredientDto[]>()
    )[0]!
    await send(
      app,
      'PUT',
      api(`/members/${guest.id}/preferences`),
      { allergies: [orechy.id], dislikes: [], diets: [] },
      as(OWNER),
    )
    await addStay(guest.id, '2026-10-06', '2026-10-06')
    await addEntry({ date: '2026-10-05', slotId: obed, recipeId: recipe.id })
    await addEntry({ date: '2026-10-06', slotId: obed, recipeId: recipe.id })
    const [before, during] = await week()
    expect(before!.warnings).toEqual([])
    expect(during!.warnings.map((w) => [w.memberName, w.kind])).toEqual([['Teta Eva', 'allergy']])
  })

  it('nákup počíta s návštevou v dňoch pobytu', async () => {
    const { obed, guest, recipe } = await setup()
    await addEntry({ date: '2026-10-06', slotId: obed, recipeId: recipe.id })
    const [list] = await (
      await send(app, 'GET', api('/shopping/lists'), undefined, as(OWNER))
    ).json<ShoppingListDto[]>()
    const generate = async () => {
      const res = await send(
        app,
        'POST',
        api(`/shopping/lists/${list!.id}/generate`),
        { from: '2026-10-05', to: '2026-10-11' },
        as(OWNER),
      )
      expect((await res.json<GenerateResult>()).added).toBeGreaterThan(0)
      const items = await (
        await send(app, 'GET', api(`/shopping/lists/${list!.id}/items`), undefined, as(OWNER))
      ).json<ShoppingItemDto[]>()
      return items.find((i) => i.name === 'Orechy')?.quantity
    }
    expect(await generate()).toBe(100) // recept pre 2 porcie, doma len Mama = 1 porcia
    await addStay(guest.id, '2026-10-06', '2026-10-06')
    expect(await generate()).toBe(200) // s návštevou 2 porcie
  })
})
