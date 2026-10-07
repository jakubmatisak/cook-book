import { describe, expect, it } from 'vitest'
import {
  activeFilterCount,
  listToParam,
  parseListQuery,
  parseRecipeView,
  queryToRestore,
  savableListQuery,
  stateToTableSort,
  tableSortToState,
  toggleValue,
} from '@/features/recipes/listQuery'

describe('parseListQuery', () => {
  it('prázdny dotaz dáva prázdny stav', () => {
    expect(parseListQuery({})).toEqual({
      q: undefined,
      category: [],
      tag: [],
      difficulty: [],
      time: [],
      favorite: false,
      pantry: false,
      kids: 'hide',
      public: 'hide',
      missing: undefined,
      sort: undefined,
      dir: undefined,
    })
  })

  it('prečíta zoznamy oddelené čiarkou a zahodí neplatné hodnoty', () => {
    const state = parseListQuery({
      q: 'guláš',
      category: 'main,nic,dessert',
      tag: 'a1,b2',
      difficulty: '1,5,x,3',
      time: 'under30,hocico,over60',
      favorites: '1',
      pantry: '1',
      sort: 'time',
      dir: 'desc',
    })
    expect(state).toMatchObject({
      q: 'guláš',
      category: ['hlavne', 'dezert'],
      tag: ['a1', 'b2'],
      difficulty: [1, 3],
      time: ['do30', 'nad60'],
      favorite: true,
      pantry: true,
      sort: 'time',
      dir: 'desc',
    })
  })

  it('neplatné zoradenie a smer sa ignorujú, pole z vue-routeru sa berie ako prvá hodnota', () => {
    expect(parseListQuery({ sort: 'nic', dir: 'hore' })).toMatchObject({
      sort: undefined,
      dir: undefined,
    })
    expect(parseListQuery({ category: ['dessert', 'main'] })).toMatchObject({ category: ['dezert'] })
  })
})

describe('parseListQuery – chýbajúce suroviny', () => {
  it('missing=0 a missing=1 sa prečítajú, iné hodnoty sa ignorujú', () => {
    expect(parseListQuery({ pantry: '1', missing: '0' }).missing).toBe(0)
    expect(parseListQuery({ pantry: '1', missing: '1' }).missing).toBe(1)
    expect(parseListQuery({ pantry: '1', missing: '2' }).missing).toBeUndefined()
    expect(parseListQuery({ pantry: '1', missing: 'x' }).missing).toBeUndefined()
    expect(parseListQuery({ pantry: '1' }).missing).toBeUndefined()
  })

  it('bez „Čo viem uvariť“ sa missing ignoruje', () => {
    expect(parseListQuery({ missing: '1' }).missing).toBeUndefined()
  })
})

describe('pomocné funkcie', () => {
  it('toggleValue pridá alebo odoberie hodnotu bez zmeny pôvodného poľa', () => {
    const list = ['a', 'b']
    expect(toggleValue(list, 'c')).toEqual(['a', 'b', 'c'])
    expect(toggleValue(list, 'a')).toEqual(['b'])
    expect(list).toEqual(['a', 'b'])
  })

  it('listToParam spojí hodnoty, prázdny zoznam nezapíše nič', () => {
    expect(listToParam(['a', 'b'])).toBe('a,b')
    expect(listToParam([1, 3])).toBe('1,3')
    expect(listToParam([])).toBeUndefined()
  })

  it('activeFilterCount počíta výbery a obľúbené, nie hľadanie ani špajzu', () => {
    const base = parseListQuery({})
    expect(activeFilterCount(base)).toBe(0)
    expect(
      activeFilterCount({
        ...base,
        q: 'x',
        pantry: true,
        category: ['hlavne'],
        tag: ['a', 'b'],
        favorite: true,
      }),
    ).toBe(4)
  })
})

describe('zoradenie tabuľky', () => {
  it('prevedie kľúče stĺpcov na kľúče zoradenia a späť', () => {
    expect(tableSortToState([{ key: 'title', order: 'desc' }])).toEqual({ sort: 'name', dir: 'desc' })
    expect(tableSortToState([{ key: 'totalMinutes', order: 'asc' }])).toEqual({ sort: 'time', dir: 'asc' })
    expect(tableSortToState([{ key: 'lastCookedAt', order: 'asc' }])).toEqual({ sort: 'cooked', dir: 'asc' })
    expect(tableSortToState([{ key: 'nieco', order: 'asc' }])).toBeNull()
    expect(tableSortToState([])).toBeNull()
    expect(stateToTableSort('created', 'desc')).toEqual([{ key: 'createdAt', order: 'desc' }])
    expect(stateToTableSort('created', undefined)).toEqual([{ key: 'createdAt', order: 'desc' }])
    expect(stateToTableSort(undefined, undefined)).toEqual([{ key: 'title', order: 'asc' }])
  })
})

describe('parseRecipeView', () => {
  it('rozpozná tabuľku, všetko ostatné je mriežka', () => {
    expect(parseRecipeView('table')).toBe('table')
    expect(parseRecipeView('grid')).toBe('grid')
    expect(parseRecipeView('hocico')).toBe('grid')
    expect(parseRecipeView(null)).toBe('grid')
  })
})

describe('predvolené filtre (pamätajú sa na používateľa)', () => {
  it('uloží len parametre filtrov a zoradenia, bez hľadaného textu a cudzích kľúčov', () => {
    expect(
      savableListQuery({
        q: 'guláš',
        category: 'dessert',
        pantry: '1',
        sort: 'time',
        dir: 'asc',
        week: 'x',
      }),
    ).toEqual({ category: 'dessert', pantry: '1', sort: 'time', dir: 'asc' })
  })

  it('berie prvú hodnotu opakovaného parametra a zahodí prázdne a nie textové', () => {
    expect(savableListQuery({ category: ['dessert', 'soup'], tag: '', time: null, difficulty: '2' })).toEqual(
      {
        category: 'dessert',
        difficulty: '2',
      },
    )
  })

  it('bez filtrov vráti null (nič sa neukladá, uložené sa vymaže)', () => {
    expect(savableListQuery({})).toBeNull()
    expect(savableListQuery({ q: 'guláš' })).toBeNull()
  })

  it('uložené filtre sa vrátia len keď adresa nenesie žiadny filter ani hľadanie', () => {
    const saved = { category: 'dessert' }
    expect(queryToRestore({}, saved)).toEqual({ category: 'dessert' })
    expect(queryToRestore({ pantry: '1' }, saved)).toBeNull()
    expect(queryToRestore({ q: 'guláš' }, saved)).toBeNull()
    expect(queryToRestore({ week: 'x' }, saved)).toEqual({ category: 'dessert' })
    expect(queryToRestore({}, undefined)).toBeNull()
    expect(queryToRestore({}, {})).toBeNull()
  })
})
