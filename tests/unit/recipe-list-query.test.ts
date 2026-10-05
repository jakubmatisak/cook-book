import { describe, expect, it } from 'vitest'
import {
  activeFilterCount,
  listToParam,
  parseListQuery,
  parseRecipeView,
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
      sort: undefined,
      dir: undefined,
    })
  })

  it('prečíta zoznamy oddelené čiarkou a zahodí neplatné hodnoty', () => {
    const state = parseListQuery({
      q: 'guláš',
      kategoria: 'hlavne,nic,dezert',
      tag: 'a1,b2',
      narocnost: '1,5,x,3',
      cas: 'do30,hocico,nad60',
      oblubene: '1',
      doma: '1',
      zoradit: 'time',
      smer: 'desc',
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
    expect(parseListQuery({ zoradit: 'nic', smer: 'hore' })).toMatchObject({
      sort: undefined,
      dir: undefined,
    })
    expect(parseListQuery({ kategoria: ['dezert', 'hlavne'] })).toMatchObject({ category: ['dezert'] })
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
