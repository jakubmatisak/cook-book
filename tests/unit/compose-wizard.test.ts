import { describe, expect, it } from 'vitest'
import type { ComposeItem, ComposeOption } from '@shared/compose'
import {
  applyItems,
  brushSummary,
  chooseRecipe,
  clearItem,
  defaultCategories,
  initialGrid,
  nextOption,
  paintCell,
  paintColumn,
  paintRow,
  rangeDates,
  repeatsOf,
  setLeftoverDays,
  summarize,
  weekdayLimits,
} from '@/features/meal-plan/compose'

const MON = '2026-10-12'
const TUE = '2026-10-13'
const WED = '2026-10-14'
const THU = '2026-10-15'

describe('sprievodca – krok 1 a 2', () => {
  it('typy jedla podľa názvu jedla dňa', () => {
    expect(defaultCategories('Raňajky')).toEqual(['ranajky'])
    expect(defaultCategories('Desiata')).toEqual(['desiata'])
    expect(defaultCategories('Olovrant')).toEqual(['desiata'])
    expect(defaultCategories('Obed')).toEqual(['hlavne'])
    expect(defaultCategories('Neskorá večera')).toEqual(['hlavne'])
  })

  it('rozsah dní od – do', () => {
    expect(rangeDates(MON, WED)).toEqual([MON, TUE, WED])
    expect(rangeDates(WED, MON)).toEqual([])
  })

  it('predvolene všetko „Všetky“, obsadené políčka „Nevypĺňať“ (ak sa nenahrádzajú)', () => {
    const occupied = new Set([`${TUE}|obed`])
    const grid = initialGrid([MON, TUE], ['obed'], occupied, false)
    expect(grid).toEqual({ [`${MON}|obed`]: 'all', [`${TUE}|obed`]: 'skip' })
    expect(initialGrid([MON, TUE], ['obed'], occupied, true)[`${TUE}|obed`]).toBe('all')
  })

  it('štetec vyfarbí políčko, riadok aj stĺpec a súhrn ich spočíta', () => {
    let grid = initialGrid([MON, TUE], ['obed', 'vecera'], new Set(), false)
    grid = paintCell(grid, MON, 'obed', 'verified')
    expect(grid[`${MON}|obed`]).toBe('verified')
    grid = paintRow(grid, TUE, ['obed', 'vecera'], 'new')
    expect([grid[`${TUE}|obed`], grid[`${TUE}|vecera`]]).toEqual(['new', 'new'])
    grid = paintColumn(grid, [MON, TUE], 'vecera', 'skip')
    expect([grid[`${MON}|vecera`], grid[`${TUE}|vecera`]]).toEqual(['skip', 'skip'])
    expect(brushSummary(grid)).toEqual({ verified: 1, new: 1 })
  })

  it('riadok ani stĺpec neprefarbí obsadené políčka (tie sa nahrádzajú len po potvrdení)', () => {
    const locked = new Set([`${MON}|obed`])
    let grid = initialGrid([MON, TUE], ['obed', 'vecera'], locked, false)
    grid = paintRow(grid, MON, ['obed', 'vecera'], 'new', locked)
    expect([grid[`${MON}|obed`], grid[`${MON}|vecera`]]).toEqual(['skip', 'new'])
    grid = paintColumn(grid, [MON, TUE], 'obed', 'verified', locked)
    expect([grid[`${MON}|obed`], grid[`${TUE}|obed`]]).toEqual(['skip', 'verified'])
  })

  it('predvoľba: pracovné dni do 30 min, víkend bez limitu', () => {
    const sat = '2026-10-17'
    const sun = '2026-10-18'
    expect(weekdayLimits([THU, sat, sun], { [sat]: 'do60' }, 'workdays')).toEqual({
      [THU]: 'do30',
      [sat]: 'do60',
    })
    expect(weekdayLimits([THU, sat, sun], { [THU]: 'do30', [sat]: 'do60' }, 'weekend')).toEqual({
      [THU]: 'do30',
    })
  })
})

const option = (id: string, over: Partial<ComposeOption> = {}): ComposeOption => ({
  recipeId: id,
  title: id,
  coverImageUrl: null,
  totalMinutes: 30,
  category: 'hlavne',
  warnings: [],
  ...over,
})

const item = (date: string, recipeId: string | null, over: Partial<ComposeItem> = {}): ComposeItem => ({
  key: `${date}|obed|main`,
  date,
  slotId: 'obed',
  course: 'main',
  recipeId,
  title: recipeId,
  coverImageUrl: null,
  totalMinutes: 30,
  category: recipeId ? 'hlavne' : null,
  leftoverOf: null,
  leftoverDays: 0,
  warnings: [],
  options: [option('gulas'), option('rezen'), option('ryza')],
  repeatsOn: [],
  ...over,
})

const k = (date: string) => `${date}|obed|main`
const view = (items: ComposeItem[]) => items.map((i) => [i.date, i.recipeId, i.leftoverOf, i.leftoverDays])

describe('sprievodca – krok 3', () => {
  it('iný návrh vezme ďalší recept, ktorý v návrhu ešte nie je (hlavné jedlá sa neopakujú)', () => {
    const items = [item(MON, 'gulas'), item(TUE, 'rezen')]
    expect(nextOption(items, k(MON))[0]!.recipeId).toBe('ryza')
    // keď už nič iné nie je, ostane pôvodný
    const full = [item(MON, 'gulas'), item(TUE, 'rezen'), item(WED, 'ryza')]
    expect(nextOption(full, k(MON))[0]!.recipeId).toBe('gulas')
  })

  it('iný návrh pri uvarenom jedle zmení aj jeho zvyšky', () => {
    const items = [
      item(MON, 'gulas', { leftoverDays: 1 }),
      item(TUE, 'gulas', { leftoverOf: k(MON), options: [] }),
    ]
    expect(view(nextOption(items, k(MON)))).toEqual([
      [MON, 'rezen', null, 1],
      [TUE, 'rezen', k(MON), 0],
    ])
  })

  it('zvyšky +N vyplnia nasledujúce dni toho istého jedla dňa, zníženie ich uvoľní', () => {
    const items = [item(MON, 'gulas'), item(TUE, 'rezen'), item(WED, 'ryza')]
    const more = setLeftoverDays(items, k(MON), 2)
    expect(view(more)).toEqual([
      [MON, 'gulas', null, 2],
      [TUE, 'gulas', k(MON), 0],
      [WED, 'gulas', k(MON), 0],
    ])
    const less = setLeftoverDays(more, k(MON), 1)
    expect(view(less)).toEqual([
      [MON, 'gulas', null, 1],
      [TUE, 'gulas', k(MON), 0],
      [WED, null, null, 0],
    ])
    // uvoľnené políčko dostane návrhy z varenia, takže „Iný návrh“ hneď funguje
    expect(nextOption(less, k(WED))[2]!.recipeId).toBe('rezen')
  })

  it('zvyšky prepíšu nasledujúce varenie aj s jeho zvyškami', () => {
    const items = [
      item(MON, 'gulas'),
      item(TUE, 'rezen', { leftoverDays: 1 }),
      item(WED, 'rezen', { leftoverOf: k(TUE), options: [] }),
      item(THU, 'ryza'),
    ]
    expect(view(setLeftoverDays(items, k(MON), 1))).toEqual([
      [MON, 'gulas', null, 1],
      [TUE, 'gulas', k(MON), 0],
      [WED, null, null, 0],
      [THU, 'ryza', null, 0],
    ])
  })

  it('vymazanie zvyškov uvoľní políčko, vymazanie varenia aj jeho zvyšky', () => {
    const items = setLeftoverDays([item(MON, 'gulas'), item(TUE, 'rezen'), item(WED, 'ryza')], k(MON), 2)
    expect(view(clearItem(items, k(WED)))).toEqual([
      [MON, 'gulas', null, 1],
      [TUE, 'gulas', k(MON), 0],
      [WED, null, null, 0],
    ])
    expect(view(clearItem(items, k(MON)))).toEqual([
      [MON, null, null, 0],
      [TUE, null, null, 0],
      [WED, null, null, 0],
    ])
  })

  it('vlastný recept na mieste zvyškov ich odpojí od varenia', () => {
    const items = setLeftoverDays([item(MON, 'gulas'), item(TUE, 'rezen')], k(MON), 1)
    const chosen = chooseRecipe(items, k(TUE), option('pizza', { warnings: [] }))
    expect(view(chosen)).toEqual([
      [MON, 'gulas', null, 0],
      [TUE, 'pizza', null, 0],
    ])
  })

  it('„Už máme“: iné dni s rovnakým receptom v návrhu alebo v jedálničku, okrem vlastných zvyškov', () => {
    const items = setLeftoverDays(
      [
        item(MON, 'gulas'),
        item(TUE, 'rezen'),
        item(WED, 'kasa', { slotId: 'ranajky', key: `${WED}|ranajky|main` }),
      ],
      k(MON),
      1,
    )
    const repeats = repeatsOf(items, [{ date: THU, recipeId: 'kasa' }])
    expect(repeats.get(k(MON))).toEqual([])
    expect(repeats.get(`${WED}|ranajky|main`)).toEqual([THU])
  })

  it('potvrdenie pošle len položky s receptom a počet zvyškov pri varení', () => {
    const items = setLeftoverDays([item(MON, 'gulas'), item(TUE, 'rezen'), item(WED, null)], k(MON), 1)
    expect(applyItems(items)).toEqual([
      { key: k(MON), date: MON, slotId: 'obed', recipeId: 'gulas', leftoverOf: null, leftoverDays: 1 },
      { key: k(TUE), date: TUE, slotId: 'obed', recipeId: 'gulas', leftoverOf: k(MON), leftoverDays: 0 },
    ])
    expect(summarize(items)).toEqual({ meals: 2, cooked: 1, leftovers: 1, empty: 1 })
  })
})
