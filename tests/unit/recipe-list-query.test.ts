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
      kids: false,
      missing: undefined,
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

describe('parseListQuery – chýbajúce suroviny', () => {
  it('chyba=0 a chyba=1 sa prečítajú, iné hodnoty sa ignorujú', () => {
    expect(parseListQuery({ doma: '1', chyba: '0' }).missing).toBe(0)
    expect(parseListQuery({ doma: '1', chyba: '1' }).missing).toBe(1)
    expect(parseListQuery({ doma: '1', chyba: '2' }).missing).toBeUndefined()
    expect(parseListQuery({ doma: '1', chyba: 'x' }).missing).toBeUndefined()
    expect(parseListQuery({ doma: '1' }).missing).toBeUndefined()
  })

  it('bez „Čo viem uvariť“ sa chyba ignoruje', () => {
    expect(parseListQuery({ chyba: '1' }).missing).toBeUndefined()
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
        kategoria: 'dezert',
        doma: '1',
        zoradit: 'time',
        smer: 'asc',
        tyzden: 'x',
      }),
    ).toEqual({ kategoria: 'dezert', doma: '1', zoradit: 'time', smer: 'asc' })
  })

  it('berie prvú hodnotu opakovaného parametra a zahodí prázdne a nie textové', () => {
    expect(
      savableListQuery({ kategoria: ['dezert', 'polievka'], tag: '', cas: null, narocnost: '2' }),
    ).toEqual({
      kategoria: 'dezert',
      narocnost: '2',
    })
  })

  it('bez filtrov vráti null (nič sa neukladá, uložené sa vymaže)', () => {
    expect(savableListQuery({})).toBeNull()
    expect(savableListQuery({ q: 'guláš' })).toBeNull()
  })

  it('uložené filtre sa vrátia len keď adresa nenesie žiadny filter ani hľadanie', () => {
    const saved = { kategoria: 'dezert' }
    expect(queryToRestore({}, saved)).toEqual({ kategoria: 'dezert' })
    expect(queryToRestore({ doma: '1' }, saved)).toBeNull()
    expect(queryToRestore({ q: 'guláš' }, saved)).toBeNull()
    expect(queryToRestore({ tyzden: 'x' }, saved)).toEqual({ kategoria: 'dezert' })
    expect(queryToRestore({}, undefined)).toBeNull()
    expect(queryToRestore({}, {})).toBeNull()
  })
})
