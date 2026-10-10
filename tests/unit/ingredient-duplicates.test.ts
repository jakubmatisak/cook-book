import { describe, expect, it } from 'vitest'
import { duplicateKey, findDuplicateGroups, ignoreKey, mixedUnits } from '@shared/ingredientDuplicates'

const ing = (id: string, name: string, usageCount = 0) => ({ id, name, usageCount })

describe('návrhy na zlúčenie ingrediencií', () => {
  it.each([
    ['Hruška', 'Hrušky'],
    ['Paradajka', 'Paradajky'],
    ['Uhorka', 'Uhorky'],
    ['Žemľa', 'Žemle'],
    ['Reďkovka', 'Reďkovky'],
    ['Maslo', 'masla'],
    ['Olej', 'Oleja'],
    ['Mlieko', 'mlieka'],
    ['Sóda bikarbóna', 'sódy bikarbóny'],
    ['Hrubá múka', 'Múka hrubá'],
    ['Mrazený hrášok', 'Hrášok mrazený'],
    ['krémový syr', 'syr krémový'],
    ['Lieskové orechy', 'orechy lieskové,'],
    ['Čili paprička', 'Čili papričky'],
    ['Vajce', 'Vajcia'],
    ['Syr', 'Syra'],
  ])('%s a %s sú tá istá ingrediencia', (a, b) => {
    expect(duplicateKey(a)).toBe(duplicateKey(b))
  })

  it.each([
    ['Bagety', 'Batáty'],
    ['Bagety', 'Špagety'],
    ['Hruška', 'Treska'],
    ['Hrášok', 'Kvások'],
    ['Bravčová masť', 'Bravčové mäso'],
    ['Hrubá múka', 'Hladká múka'],
    ['mlieka', 'Sliepka'],
  ])('%s a %s sú rôzne ingrediencie', (a, b) => {
    expect(duplicateKey(a)).not.toBe(duplicateKey(b))
  })

  it('zoskupí duplicity, cieľom je najpoužívanejšia, ignorované skupiny vynechá', () => {
    const list = [
      ing('1', 'Paradajka', 2),
      ing('2', 'Paradajky', 7),
      ing('3', 'Uhorka', 1),
      ing('4', 'Uhorky', 1),
      ing('5', 'Cesnak', 4),
    ]
    expect(findDuplicateGroups(list, [])).toEqual([
      { key: ignoreKey(['1', '2']), ids: ['2', '1'], targetId: '2' },
      { key: ignoreKey(['3', '4']), ids: ['3', '4'], targetId: '3' },
    ])
    expect(findDuplicateGroups(list, [ignoreKey(['4', '3'])]).map((g) => g.ids)).toEqual([['2', '1']])
  })

  it('ignorovaná skupina sa ukáže znova, keď k nej pribudne ďalší tvar', () => {
    const ignored = [ignoreKey(['1', '2'])]
    const list = [ing('1', 'Cibuľa', 3), ing('2', 'Cibule'), ing('3', 'cibuli')]
    expect(findDuplicateGroups(list, ignored).map((g) => g.ids)).toEqual([['1', '2', '3']])
  })

  it('rozpozná jednotky, ktoré sa nedajú prepočítať', () => {
    expect(mixedUnits([['g'], ['kg']])).toEqual([])
    expect(mixedUnits([['g', 'kg'], ['ks']])).toEqual(['g', 'kg', 'ks'])
    expect(mixedUnits([['ml'], ['l', null]])).toEqual([])
    expect(mixedUnits([[], ['ks']])).toEqual([])
  })
})
