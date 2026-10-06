import { describe, expect, it } from 'vitest'
import type {
  ApiErrorBody,
  FamilyMemberDto,
  GenerateResult,
  IngredientDto,
  MeResponse,
  PlanEntryDto,
  RecipeDetailDto,
  ShoppingItemDto,
  ShoppingListDto,
} from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

async function setup() {
  const me = await (await send(app, 'GET', api('/me'))).json<MeResponse>()
  const obed = me.slots.find((s) => s.name === 'Obed')!.id
  const make = async (name: string, kind: string) =>
    (await (await send(app, 'POST', api('/members'), { name, kind })).json()) as FamilyMemberDto
  const adult = await make('Mama', 'adult')
  const guest = await make('Teta Anna', 'guest')
  const otherGuest = await make('Strýko Peter', 'guest')
  const recipe = await (
    await send(app, 'POST', api('/recipes'), {
      title: 'Orechová torta',
      servings: 2,
      ingredients: [{ name: 'Orechy', quantity: 200, unit: 'g', isOptional: false }],
    })
  ).json<RecipeDetailDto>()
  return { obed, adult, guest, otherGuest, recipe }
}

const addEntry = (body: object) => send(app, 'POST', api('/plan/entries'), body)
const week = async () =>
  (await (await send(app, 'GET', api('/plan?from=2026-10-05&to=2026-10-11'))).json()) as PlanEntryDto[]

describe('návštevy v rodine', () => {
  it('návšteva sa dá pridať ako osoba typu guest', async () => {
    const { guest } = await setup()
    expect(guest).toMatchObject({ name: 'Teta Anna', kind: 'guest' })
  })
})

describe('návštevy pri jedle', () => {
  it('záznam si pamätá vybrané návštevy; bez výberu je zoznam prázdny', async () => {
    const { obed, guest, recipe } = await setup()
    const withGuest = await addEntry({
      date: '2026-10-05',
      slotId: obed,
      recipeId: recipe.id,
      guestIds: [guest.id],
    })
    expect(withGuest.status).toBe(201)
    expect((await withGuest.json<PlanEntryDto>()).guestIds).toEqual([guest.id])
    await addEntry({ date: '2026-10-06', slotId: obed, recipeId: recipe.id })

    expect((await week()).map((e) => e.guestIds)).toEqual([[guest.id], []])
  })

  it('úprava nahradí návštevy a prázdny zoznam ich zruší', async () => {
    const { obed, guest, otherGuest, recipe } = await setup()
    const created = await (
      await addEntry({ date: '2026-10-05', slotId: obed, recipeId: recipe.id, guestIds: [guest.id] })
    ).json<PlanEntryDto>()
    const put = (guestIds: string[]) =>
      send(app, 'PUT', api(`/plan/entries/${created.id}`), {
        date: '2026-10-05',
        slotId: obed,
        recipeId: recipe.id,
        guestIds,
      })
    expect((await (await put([otherGuest.id, guest.id])).json<PlanEntryDto>()).guestIds.sort()).toEqual(
      [guest.id, otherGuest.id].sort(),
    )
    expect((await (await put([])).json<PlanEntryDto>()).guestIds).toEqual([])
  })

  it('vybrať sa dá len návšteva z vlastnej domácnosti, nie dospelý ani neznáme ID', async () => {
    const { obed, adult, recipe } = await setup()
    for (const id of [adult.id, 'neexistuje']) {
      const res = await addEntry({ date: '2026-10-05', slotId: obed, recipeId: recipe.id, guestIds: [id] })
      expect(res.status).toBe(400)
      expect((await res.json<ApiErrorBody>()).error.code).toBe('invalid_guest')
    }
  })

  it('alergia návštevy upozorní len pri jedle, kde je vybraná', async () => {
    const { obed, guest, recipe } = await setup()
    const orechy = (await (await send(app, 'GET', api('/ingredients?q=orech'))).json<IngredientDto[]>())[0]!
    await send(app, 'PUT', api(`/members/${guest.id}/preferences`), {
      allergies: [orechy.id],
      dislikes: [],
      diets: [],
    })
    await addEntry({ date: '2026-10-05', slotId: obed, recipeId: recipe.id, guestIds: [guest.id] })
    await addEntry({ date: '2026-10-06', slotId: obed, recipeId: recipe.id })

    const [withGuest, without] = await week()
    expect(withGuest!.warnings.map((w) => [w.memberName, w.kind])).toEqual([['Teta Anna', 'allergy']])
    expect(without!.warnings).toEqual([])
  })

  it('nákup počíta s návštevou vybranou pri jedle', async () => {
    const { obed, guest, recipe } = await setup()
    await addEntry({ date: '2026-10-05', slotId: obed, recipeId: recipe.id, guestIds: [guest.id] })
    const [list] = await (await send(app, 'GET', api('/shopping/lists'))).json<ShoppingListDto[]>()
    const generated = await send(app, 'POST', api(`/shopping/lists/${list!.id}/generate`), {
      from: '2026-10-05',
      to: '2026-10-11',
    })
    expect((await generated.json<GenerateResult>()).added).toBeGreaterThan(0)
    const items = await (
      await send(app, 'GET', api(`/shopping/lists/${list!.id}/items`))
    ).json<ShoppingItemDto[]>()
    // recept pre 2 porcie, rodina Mama (1) + vybraná návšteva (1) = 2 porcie → 200 g orechov
    expect(items.find((i) => i.name === 'Orechy')?.quantity).toBe(200)
  })

  it('kópia týždňa neprenáša návštevy', async () => {
    const { obed, guest, recipe } = await setup()
    await addEntry({ date: '2026-10-05', slotId: obed, recipeId: recipe.id, guestIds: [guest.id] })
    const copied = await send(app, 'POST', api('/plan/copy'), {
      fromDate: '2026-10-05',
      toDate: '2026-10-12',
      days: 7,
      replace: false,
    })
    expect(copied.status).toBe(200)
    const next = (await (
      await send(app, 'GET', api('/plan?from=2026-10-12&to=2026-10-18'))
    ).json()) as PlanEntryDto[]
    expect(next.map((e) => e.guestIds)).toEqual([[]])
  })
})
