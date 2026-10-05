import { describe, expect, it } from 'vitest'
import {
  buildShoppingItems,
  parseItemText,
  roundForShopping,
  type ShoppingInputEntry,
  type ShoppingInputIngredient,
} from '@shared/shopping'
import { generateSchema } from '@shared/schemas/shopping'

const family = [
  { kind: 'adult' as const, portionFactor: 1, isActive: true },
  { kind: 'adult' as const, portionFactor: 1, isActive: true },
  { kind: 'child' as const, portionFactor: 0.5, isActive: true },
  { kind: 'child' as const, portionFactor: 0.5, isActive: true },
]

let seq = 0
const ing = (
  ingredientId: string,
  name: string,
  quantity: number | null,
  unit: ShoppingInputIngredient['unit'],
  extra: Partial<ShoppingInputIngredient> = {},
): ShoppingInputIngredient => ({
  recipeIngredientId: `ri${++seq}`,
  ingredientId,
  name,
  quantity,
  unit,
  isOptional: false,
  shopCategoryId: null,
  ...extra,
})

const entry = (
  id: string,
  servings: number,
  ingredients: ShoppingInputIngredient[],
  servingsOverride: number | null = null,
): ShoppingInputEntry => ({
  id,
  date: '2026-10-05',
  servingsOverride,
  audience: 'all',
  recipe: { id: `r-${id}`, title: `Recept ${id}`, servings, ingredients },
})

describe('buildShoppingItems', () => {
  it('prepočíta porcie podľa rodiny a zaokrúhli kusy nahor', () => {
    const items = buildShoppingItems({
      entries: [entry('gulas', 4, [ing('maso', 'Hovädzie', 800, 'g'), ing('vajce', 'Vajcia', 3, 'ks')])],
      members: family,
    })
    expect(items.map((i) => [i.name, i.quantity, i.unit])).toEqual([
      ['Hovädzie', 600, 'g'],
      ['Vajcia', 3, 'ks'],
    ])
  })

  it('sčíta rovnakú ingredienciu z viacerých receptov aj cez kg a g', () => {
    const items = buildShoppingItems({
      entries: [
        entry('a', 4, [ing('muka', 'Múka', 0.5, 'kg')], 4),
        entry('b', 2, [ing('muka', 'Múka', 250, 'g')], 2),
      ],
      members: family,
    })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ ingredientId: 'muka', quantity: 750, unit: 'g' })
    expect(items[0]!.sources.map((s) => [s.planEntryId, s.quantity])).toEqual([
      ['a', 500],
      ['b', 250],
    ])
  })

  it('neprevoditeľné jednotky ostanú ako samostatné položky', () => {
    const items = buildShoppingItems({
      entries: [entry('a', 4, [ing('olej', 'Olej', 2, 'PL'), ing('olej', 'Olej', 100, 'ml')], 4)],
      members: [],
    })
    expect(items.map((i) => [i.quantity, i.unit])).toEqual([
      [2, 'PL'],
      [100, 'ml'],
    ])
  })

  it('ingrediencia bez množstva sa pridá len ak nie je aj s množstvom', () => {
    const both = buildShoppingItems({
      entries: [entry('a', 4, [ing('sol', 'Soľ', null, null), ing('sol', 'Soľ', 5, 'g')], 4)],
      members: [],
    })
    expect(both.map((i) => [i.name, i.quantity, i.unit])).toEqual([['Soľ', 5, 'g']])
    expect(both[0]!.sources).toHaveLength(2)

    const onlyNull = buildShoppingItems({
      entries: [entry('a', 4, [ing('sol', 'Soľ', null, null)])],
      members: [],
    })
    expect(onlyNull.map((i) => [i.name, i.quantity, i.unit])).toEqual([['Soľ', null, null]])
  })

  it('vynechá voliteľné ingrediencie a jedlá s vlastným textom', () => {
    const items = buildShoppingItems({
      entries: [
        entry('a', 4, [ing('rasca', 'Rasca', 1, 'ČL', { isOptional: true })]),
        { id: 'text', date: '2026-10-06', servingsOverride: null, audience: 'all', recipe: null },
      ],
      members: family,
    })
    expect(items).toEqual([])
  })

  it('bez členov rodiny použije porcie receptu', () => {
    const items = buildShoppingItems({
      entries: [entry('a', 4, [ing('maso', 'Mäso', 800, 'g')])],
      members: [],
    })
    expect(items[0]?.quantity).toBe(800)
  })

  it('položky zoradí podľa názvu bez diakritiky a zachová kategóriu obchodu', () => {
    const items = buildShoppingItems({
      entries: [
        entry('a', 1, [
          ing('z', 'Zemiaky', 1, 'kg', { shopCategoryId: 'zelenina' }),
          ing('c', 'Čučoriedky', 100, 'g'),
          ing('a', 'Avokádo', 1, 'ks'),
        ]),
      ],
      members: [],
    })
    expect(items.map((i) => [i.name, i.shopCategoryId])).toEqual([
      ['Avokádo', null],
      ['Čučoriedky', null],
      ['Zemiaky', 'zelenina'],
    ])
  })
})

describe('roundForShopping', () => {
  it('kusy a balenia nahor, ostatné na dve desatinné miesta', () => {
    expect(roundForShopping(2.25, 'ks')).toBe(3)
    expect(roundForShopping(0.5, 'balenie')).toBe(1)
    expect(roundForShopping(2, 'ks')).toBe(2)
    expect(roundForShopping(1.5, 'PL')).toBe(1.5)
    expect(roundForShopping(0.3333, 'šálka')).toBe(0.33)
    expect(roundForShopping(null, 'g')).toBeNull()
  })
})

describe('roundForShopping – gramy a mililitre', () => {
  it('zaokrúhli nahor na krok, ktorý dáva zmysel v obchode', () => {
    expect(roundForShopping(7.2, 'g')).toBe(8)
    expect(roundForShopping(37.5, 'g')).toBe(40)
    expect(roundForShopping(208.33, 'g')).toBe(210)
    expect(roundForShopping(416.67, 'ml')).toBe(420)
    expect(roundForShopping(600, 'g')).toBe(600)
  })
})

describe('parseItemText', () => {
  it('rozpozná množstvo a jednotku na začiatku', () => {
    expect(parseItemText('2 kg zemiaky')).toEqual({ name: 'zemiaky', quantity: 2, unit: 'kg' })
    expect(parseItemText('1,5 l mlieka')).toEqual({ name: 'mlieka', quantity: 1.5, unit: 'l' })
    expect(parseItemText('500g múky')).toEqual({ name: 'múky', quantity: 500, unit: 'g' })
    expect(parseItemText('3 vajcia')).toEqual({ name: 'vajcia', quantity: 3, unit: null })
  })

  it('bez čísla je to len názov', () => {
    expect(parseItemText('  Toaletný papier ')).toEqual({
      name: 'Toaletný papier',
      quantity: null,
      unit: null,
    })
    expect(parseItemText('2')).toEqual({ name: '2', quantity: null, unit: null })
  })
})

describe('generateSchema', () => {
  it('najviac 31 dní', () => {
    expect(generateSchema.safeParse({ from: '2026-10-05', to: '2026-10-11' }).success).toBe(true)
    expect(generateSchema.safeParse({ from: '2026-10-05', to: '2026-11-30' }).success).toBe(false)
  })
})

describe('parseItemText – slovenské tvary jednotiek a okraje', () => {
  it('rozpozná skloňované jednotky', () => {
    expect(parseItemText('2 šálky múky')).toEqual({ name: 'múky', quantity: 2, unit: 'šálka' })
    expect(parseItemText('3 lyžice oleja')).toEqual({ name: 'oleja', quantity: 3, unit: 'PL' })
    expect(parseItemText('1 lyžička soli')).toEqual({ name: 'soli', quantity: 1, unit: 'ČL' })
    expect(parseItemText('1,5 litra mlieka')).toEqual({ name: 'mlieka', quantity: 1.5, unit: 'l' })
    expect(parseItemText('6 kusov rožkov')).toEqual({ name: 'rožkov', quantity: 6, unit: 'ks' })
    expect(parseItemText('2 ČL soli')).toEqual({ name: 'soli', quantity: 2, unit: 'ČL' })
  })

  it('množstvo bez názvu alebo nulové množstvo je celý text', () => {
    expect(parseItemText('100 g')).toEqual({ name: '100 g', quantity: null, unit: null })
    expect(parseItemText('0 kg zemiaky')).toEqual({ name: '0 kg zemiaky', quantity: null, unit: null })
  })
})
