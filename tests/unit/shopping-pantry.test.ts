import { describe, expect, it } from 'vitest'
import { addDays } from '@shared/dates'
import {
  buildShoppingItems,
  isStapleDue,
  planShopping,
  type PantryStock,
  type ShoppingInputEntry,
  type ShoppingInputIngredient,
  type StapleInput,
} from '@shared/shopping'

let seq = 0
const ing = (
  ingredientId: string,
  name: string,
  quantity: number | null,
  unit: ShoppingInputIngredient['unit'],
): ShoppingInputIngredient => ({
  recipeIngredientId: `ri${++seq}`,
  ingredientId,
  name,
  quantity,
  unit,
  isOptional: false,
  shopCategoryId: null,
})

const entry = (ingredients: ShoppingInputIngredient[]): ShoppingInputEntry => ({
  id: `e${++seq}`,
  date: '2026-10-05',
  servingsOverride: null,
  audience: 'all',
  recipe: { id: `r${seq}`, title: 'Recept', servings: 4, ingredients },
})

const stock = (
  ingredientId: string,
  quantity: number | null,
  unit: PantryStock['unit'],
  expiresOn: string | null = null,
): PantryStock => ({ ingredientId, quantity, unit, expiresOn })

const FROM = '2026-10-05'
const plan = (ingredients: ShoppingInputIngredient[], pantry: PantryStock[], staples: StapleInput[] = []) =>
  planShopping({ entries: [entry(ingredients)], members: [], pantry, staples, from: FROM })

const rows = (p: ReturnType<typeof planShopping>) => p.items.map((i) => [i.name, i.quantity, i.unit])

describe('špajza znižuje nákup', () => {
  it('odpočíta množstvo v rovnakej jednotke a zaokrúhli až zvyšok', () => {
    const p = plan([ing('muka', 'Múka', 250, 'g')], [stock('muka', 40, 'g')])
    expect(rows(p)).toEqual([['Múka', 210, 'g']])
    expect(p.reduced).toEqual(['Múka'])
    expect(p.covered).toEqual([])
  })

  it('prevádza kg a g, aj keď sú recept a špajza v rôznych jednotkách', () => {
    const p = plan([ing('muka', 'Múka', 0.5, 'kg')], [stock('muka', 0.2, 'kg')])
    expect(rows(p)).toEqual([['Múka', 300, 'g']])
  })

  it('keď špajza stačí, položka sa vynechá a ide medzi pokryté', () => {
    const p = plan([ing('muka', 'Múka', 100, 'g')], [stock('muka', 250, 'g')])
    expect(p.items).toEqual([])
    expect(p.covered).toEqual(['Múka'])
  })

  it('nezhodná jednotka nič neodpočíta', () => {
    const p = plan([ing('vajce', 'Vajcia', 3, 'ks')], [stock('vajce', 500, 'g')])
    expect(rows(p)).toEqual([['Vajcia', 3, 'ks']])
    expect(p.covered).toEqual([])
    expect(p.reduced).toEqual([])
  })

  it('položka špajze bez množstva pokryje ingredienciu v každej jednotke', () => {
    const p = plan(
      [ing('olej', 'Olej', 50, 'ml'), ing('olej', 'Olej', 1, 'PL'), ing('soľ', 'Soľ', 5, 'g')],
      [stock('olej', null, null)],
    )
    expect(rows(p)).toEqual([['Soľ', 5, 'g']])
    expect(p.covered).toEqual(['Olej', 'Olej'])
  })

  it('ingrediencia bez množstva v recepte je pokrytá, keď ju máme doma', () => {
    const p = plan([ing('soľ', 'Soľ', null, null)], [stock('soľ', 100, 'g')])
    expect(p.items).toEqual([])
    expect(p.covered).toEqual(['Soľ'])
  })

  it('exspirované položky sa ignorujú, posledný deň ešte platí', () => {
    const expired = plan([ing('mlieko', 'Mlieko', 500, 'ml')], [stock('mlieko', 1000, 'ml', '2026-10-04')])
    expect(rows(expired)).toEqual([['Mlieko', 500, 'ml']])
    const lastDay = plan([ing('mlieko', 'Mlieko', 500, 'ml')], [stock('mlieko', 1000, 'ml', FROM)])
    expect(lastDay.items).toEqual([])
    const unbounded = plan([ing('mlieko', 'Mlieko', 500, 'ml')], [stock('mlieko', null, null, '2026-09-01')])
    expect(rows(unbounded)).toEqual([['Mlieko', 500, 'ml']])
  })

  it('viac balení tej istej ingrediencie sa sčíta', () => {
    const p = plan([ing('muka', 'Múka', 500, 'g')], [stock('muka', 100, 'g'), stock('muka', 150, 'g')])
    expect(rows(p)).toEqual([['Múka', 250, 'g']])
  })

  it('bez zadaného dňa sa exspirácia neposudzuje', () => {
    const p = planShopping({
      entries: [entry([ing('muka', 'Múka', 100, 'g')])],
      members: [],
      pantry: [stock('muka', 500, 'g', '2000-01-01')],
    })
    expect(p.items).toEqual([])
  })

  it('bez špajze sa buildShoppingItems správa ako predtým', () => {
    const items = buildShoppingItems({ entries: [entry([ing('muka', 'Múka', 100, 'g')])], members: [] })
    expect(items.map((i) => [i.name, i.quantity, i.kind])).toEqual([['Múka', 100, 'recipe']])
  })
})

describe('isStapleDue', () => {
  it('každý týždeň je vždy na rade, inak podľa týždňa a nie dňa', () => {
    expect(isStapleDue(1, FROM)).toBe(true)
    expect(isStapleDue(1, addDays(FROM, 9))).toBe(true)
    // streda toho istého týždňa ako pondelok
    expect(isStapleDue(2, addDays(FROM, 2))).toBe(isStapleDue(2, FROM))
    expect(isStapleDue(2, FROM)).not.toBe(isStapleDue(2, addDays(FROM, 7)))
    expect(isStapleDue(2, FROM)).toBe(isStapleDue(2, addDays(FROM, 14)))
  })

  it('pri trojtýždennom rytme je na rade práve jeden z troch po sebe idúcich týždňov', () => {
    const due = [0, 7, 14].filter((d) => isStapleDue(3, addDays(FROM, d)))
    expect(due).toHaveLength(1)
  })

  it('neplatný rytmus berie ako každý týždeň', () => {
    expect(isStapleDue(0, FROM)).toBe(true)
    expect(isStapleDue(-2, FROM)).toBe(true)
  })
})

describe('stále položky', () => {
  const milk = (extra: Partial<StapleInput> = {}): StapleInput => ({
    ingredientId: 'mlieko',
    name: 'Mlieko',
    shopCategoryId: 'mliecne',
    quantity: 2,
    unit: 'l',
    everyNWeeks: 1,
    ...extra,
  })

  it('pridá položku na rade v základnej jednotke a označí ju ako stálu', () => {
    const p = plan([], [], [milk()])
    expect(p.items).toHaveLength(1)
    expect(p.items[0]).toMatchObject({
      ingredientId: 'mlieko',
      name: 'Mlieko',
      quantity: 2000,
      unit: 'ml',
      kind: 'staple',
      shopCategoryId: 'mliecne',
      sources: [],
    })
    expect(p.staplesAdded).toBe(1)
  })

  it('nepridá položku, ktorá v tomto týždni nie je na rade', () => {
    const due = isStapleDue(2, FROM)
    const p = plan([], [], [milk({ everyNWeeks: 2 })])
    expect(p.items).toHaveLength(due ? 1 : 0)
    expect(p.staplesAdded).toBe(due ? 1 : 0)
  })

  it('stála položka bez množstva sa pridá bez množstva', () => {
    const p = plan([], [], [milk({ quantity: null, unit: null, name: 'Chlieb', ingredientId: 'chlieb' })])
    expect(rows(p)).toEqual([['Chlieb', null, null]])
  })

  it('špajza pokrýva aj stále položky', () => {
    const p = plan([], [stock('mlieko', 3, 'l')], [milk()])
    expect(p.items).toEqual([])
    expect(p.covered).toEqual(['Mlieko'])
    expect(p.staplesAdded).toBe(0)
  })

  it('zásoba sa spotrebuje najprv na recept a zvyšok sa odpočíta zo stálej položky', () => {
    const p = plan(
      [ing('muka', 'Múka', 100, 'g')],
      [stock('muka', 300, 'g')],
      [milk({ ingredientId: 'muka', name: 'Múka', quantity: 500, unit: 'g' })],
    )
    expect(p.items.map((i) => [i.kind, i.quantity])).toEqual([['staple', 300]])
    expect(p.covered).toEqual(['Múka'])
  })

  it('bez zadaného dňa sa stále položky nepridávajú', () => {
    const p = planShopping({ entries: [], members: [], staples: [milk()] })
    expect(p.items).toEqual([])
  })
})
