import { describe, expect, it } from 'vitest'
import {
  applyRecipeFilters,
  computeFacets,
  defaultSortDir,
  sortRecipes,
  timeBucket,
  type FacetRow,
} from '@shared/recipeFacets'

const row = (id: string, extra: Partial<FacetRow> = {}): FacetRow => ({
  id,
  title: id,
  category: 'hlavne',
  difficulty: 1,
  totalMinutes: 30,
  tagIds: [],
  isFavorite: false,
  createdAt: '2026-10-01T10:00:00.000Z',
  lastCookedAt: null,
  missing: undefined,
  ...extra,
})

const rows: FacetRow[] = [
  row('Guláš', { category: 'hlavne', difficulty: 2, totalMinutes: 140, tagIds: ['klasika', 'vikend'] }),
  row('Palacinky', { category: 'dezert', difficulty: 1, totalMinutes: 30, tagIds: ['detske', 'rychle'] }),
  row('Rizoto', { category: 'hlavne', difficulty: 2, totalMinutes: 45, tagIds: ['rychle'] }),
  row('Polievka', { category: 'polievka', difficulty: 1, totalMinutes: null, tagIds: [] }),
]

describe('timeBucket', () => {
  it('rozdelí čas do košov a chýbajúci čas nepatrí nikam', () => {
    expect(timeBucket(0)).toBe('do30')
    expect(timeBucket(30)).toBe('do30')
    expect(timeBucket(31)).toBe('do60')
    expect(timeBucket(60)).toBe('do60')
    expect(timeBucket(61)).toBe('nad60')
    expect(timeBucket(null)).toBeNull()
  })
})

describe('applyRecipeFilters', () => {
  it('bez filtrov vráti všetko', () => {
    expect(applyRecipeFilters(rows, {})).toHaveLength(4)
  })

  it('viac hodnôt v jednom rozmere je „alebo“, rôzne rozmery „a“', () => {
    expect(applyRecipeFilters(rows, { category: ['dezert', 'polievka'] }).map((r) => r.id)).toEqual([
      'Palacinky',
      'Polievka',
    ])
    expect(applyRecipeFilters(rows, { tag: ['rychle', 'klasika'] }).map((r) => r.id)).toEqual([
      'Guláš',
      'Palacinky',
      'Rizoto',
    ])
    expect(
      applyRecipeFilters(rows, { category: ['hlavne'], difficulty: [2], time: ['do60'] }).map((r) => r.id),
    ).toEqual(['Rizoto'])
  })

  it('časový filter vylúči recepty bez času a obľúbené filtruje samostatne', () => {
    expect(applyRecipeFilters(rows, { time: ['do30', 'do60', 'nad60'] })).toHaveLength(3)
    const withFav = rows.map((r) => (r.id === 'Rizoto' ? { ...r, isFavorite: true } : r))
    expect(applyRecipeFilters(withFav, { favorite: true }).map((r) => r.id)).toEqual(['Rizoto'])
  })
})

describe('computeFacets', () => {
  it('počty bez filtrov sú počty receptov pri každej možnosti', () => {
    const f = computeFacets(rows, {})
    expect(f.category).toEqual({ hlavne: 2, dezert: 1, polievka: 1 })
    expect(f.tag).toEqual({ klasika: 1, vikend: 1, detske: 1, rychle: 2 })
    expect(f.difficulty).toEqual({ 1: 2, 2: 2 })
    expect(f.time).toEqual({ do30: 1, do60: 1, nad60: 1 })
  })

  it('počet pri možnosti rešpektuje ostatné rozmery, ale nie vlastný', () => {
    const f = computeFacets(rows, { category: ['hlavne'] })
    // kategórie sa nezužujú vlastným filtrom
    expect(f.category).toEqual({ hlavne: 2, dezert: 1, polievka: 1 })
    // ostatné rozmery vidia len hlavné jedlá
    expect(f.tag).toEqual({ klasika: 1, vikend: 1, rychle: 1 })
    expect(f.difficulty).toEqual({ 2: 2 })
    expect(f.time).toEqual({ do60: 1, nad60: 1 })
  })

  it('výber v jednom rozmere zužuje druhý a naopak', () => {
    const f = computeFacets(rows, { tag: ['rychle'], difficulty: [1] })
    expect(f.category).toEqual({ dezert: 1 })
    expect(f.tag).toEqual({ detske: 1, rychle: 1 })
    expect(f.difficulty).toEqual({ 1: 1, 2: 1 })
  })

  it('obľúbené sa berie ako filter pre všetky rozmery', () => {
    const withFav = rows.map((r) => (r.id === 'Guláš' ? { ...r, isFavorite: true } : r))
    expect(computeFacets(withFav, { favorite: true }).category).toEqual({ hlavne: 1 })
  })
})

describe('sortRecipes', () => {
  const sorted = (key: Parameters<typeof sortRecipes>[1], dir?: 'asc' | 'desc') =>
    sortRecipes(
      [
        row('B', {
          title: 'Bryndza',
          totalMinutes: 20,
          difficulty: 3,
          createdAt: '2026-10-02T00:00:00.000Z',
          lastCookedAt: '2026-09-01',
        }),
        row('A', {
          title: 'Ťava',
          totalMinutes: null,
          difficulty: 1,
          createdAt: '2026-10-03T00:00:00.000Z',
          lastCookedAt: null,
        }),
        row('C', {
          title: 'čaj',
          totalMinutes: 90,
          difficulty: 2,
          createdAt: '2026-10-01T00:00:00.000Z',
          lastCookedAt: '2026-10-04',
        }),
      ],
      key,
      dir,
    ).map((r) => r.id)

  it('názov bez ohľadu na diakritiku a veľkosť písmen', () => {
    expect(sorted('name')).toEqual(['B', 'C', 'A'])
    expect(sorted('name', 'desc')).toEqual(['A', 'C', 'B'])
  })

  it('dátum pridania: predvolene od najnovšieho', () => {
    expect(sorted('created')).toEqual(['A', 'B', 'C'])
    expect(sorted('created', 'asc')).toEqual(['C', 'B', 'A'])
  })

  it('čas a náročnosť od najmenšej, chýbajúci čas vždy na konci', () => {
    expect(sorted('time')).toEqual(['B', 'C', 'A'])
    expect(sorted('time', 'desc')).toEqual(['C', 'B', 'A'])
    expect(sorted('difficulty')).toEqual(['A', 'C', 'B'])
  })

  it('naposledy varené: najdávnejšie prvé, nikdy nevarené na konci v oboch smeroch', () => {
    expect(sorted('cooked')).toEqual(['B', 'C', 'A'])
    expect(sorted('cooked', 'desc')).toEqual(['C', 'B', 'A'])
  })

  it('predvolený smer podľa kľúča', () => {
    expect(defaultSortDir('name')).toBe('asc')
    expect(defaultSortDir('created')).toBe('desc')
    expect(defaultSortDir('time')).toBe('asc')
    expect(defaultSortDir('cooked')).toBe('asc')
  })

  it('stabilné poradie pri rovnakej hodnote (podľa názvu)', () => {
    const result = sortRecipes(
      [row('x', { title: 'Zebra', difficulty: 1 }), row('y', { title: 'Avokádo', difficulty: 1 })],
      'difficulty',
    )
    expect(result.map((r) => r.title)).toEqual(['Avokádo', 'Zebra'])
  })
})

describe('chýbajúce suroviny (Čo viem uvariť)', () => {
  const withMissing = (id: string, missing: string[]): FacetRow => row(id, { missing })
  const list = [
    withMissing('a', []),
    withMissing('b', ['múka']),
    withMissing('c', ['múka', 'vajcia']),
    withMissing('d', ['x', 'y', 'z']),
  ]

  it('filter missingMax nechá recepty, kde chýba najviac toľko surovín', () => {
    expect(applyRecipeFilters(list, { missingMax: 0 }).map((r) => r.id)).toEqual(['a'])
    expect(applyRecipeFilters(list, { missingMax: 1 }).map((r) => r.id)).toEqual(['a', 'b'])
    expect(applyRecipeFilters(list, {}).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('recepty bez údaja o chýbajúcich surovinách filter missingMax vylúči', () => {
    expect(applyRecipeFilters([row('x')], { missingMax: 5 })).toEqual([])
  })

  it('počty podľa počtu chýbajúcich: 0, 1 a 2 a viac', () => {
    expect(computeFacets(list, {}).missing).toEqual({ 0: 1, 1: 1, 2: 2 })
  })

  it('počty pri chýbajúcich nezužuje vlastný filter, ale ostatné áno', () => {
    expect(computeFacets(list, { missingMax: 0 }).missing).toEqual({ 0: 1, 1: 1, 2: 2 })
    const mixed = [
      row('p', { category: 'dezert', missing: [] }),
      row('q', { category: 'hlavne', missing: ['x'] }),
    ]
    expect(computeFacets(mixed, { category: ['hlavne'] }).missing).toEqual({ 1: 1 })
  })

  it('bez údaja o chýbajúcich sa nič nepočíta', () => {
    expect(computeFacets([row('x')], {}).missing).toEqual({})
  })
})

describe('Hodí sa aj ako – ďalšie typy jedla', () => {
  const lievance = row('Lievance', { category: 'ranajky', alsoCategories: ['desiata', 'dezert'] })
  const kasa = row('Kaša', { category: 'ranajky' })

  it('filter typu jedla nájde recept podľa hlavného typu aj podľa „hodí sa aj ako“', () => {
    expect(applyRecipeFilters([lievance, kasa], { category: ['desiata'] }).map((r) => r.id)).toEqual([
      'Lievance',
    ])
    expect(applyRecipeFilters([lievance, kasa], { category: ['ranajky'] }).map((r) => r.id)).toEqual([
      'Lievance',
      'Kaša',
    ])
  })

  it('počty v kategóriách zarátajú recept do každého jeho typu (raz)', () => {
    const facets = computeFacets(
      [lievance, kasa, row('Dvakrát', { category: 'dezert', alsoCategories: ['dezert'] })],
      {},
    )
    expect(facets.category).toEqual({ ranajky: 2, desiata: 1, dezert: 2 })
  })
})
