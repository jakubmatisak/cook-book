import { describe, expect, it } from 'vitest'
import {
  describeWarning,
  preferenceConflicts,
  type PreferenceMember,
  type PreferenceWarning,
} from '@shared/preferences'

const member = (
  id: string,
  name: string,
  kind: PreferenceMember['kind'],
  preferences: PreferenceMember['preferences'] = [],
  isActive = true,
): PreferenceMember => ({ id, name, kind, isActive, preferences })

const allergy = (ingredientId: string, label: string) => ({
  kind: 'allergy' as const,
  ingredientId,
  tagId: null,
  label,
})
const dislike = (ingredientId: string, label: string) => ({
  kind: 'dislike' as const,
  ingredientId,
  tagId: null,
  label,
})
const diet = (tagId: string, label: string) => ({ kind: 'diet' as const, ingredientId: null, tagId, label })

const recipe = (ingredientIds: string[], tagIds: string[] = []) => ({ ingredientIds, tagIds })

const mama = member('m', 'Mama', 'adult', [allergy('orechy', 'Orechy')])
const ema = member('e', 'Ema', 'child', [dislike('huby', 'Huby'), allergy('mlieko', 'Mlieko')])
const tato = member('t', 'Tato', 'adult', [diet('vegetarian', 'Vegetariánske')])

describe('preferenceConflicts', () => {
  it('bez preferencií alebo bez zhody nie je čo hlásiť', () => {
    expect(preferenceConflicts(recipe(['muka']), [member('x', 'Jakub', 'adult')], 'all')).toEqual([])
    expect(preferenceConflicts(recipe(['muka']), [mama, ema], 'all')).toEqual([])
  })

  it('alergia a averzia na ingredienciu, s menom člena a názvom', () => {
    expect(preferenceConflicts(recipe(['orechy', 'huby']), [mama, ema], 'all')).toEqual<PreferenceWarning[]>([
      { memberId: 'm', memberName: 'Mama', kind: 'allergy', label: 'Orechy' },
      { memberId: 'e', memberName: 'Ema', kind: 'dislike', label: 'Huby' },
    ])
  })

  it('alergie idú pred averziami bez ohľadu na poradie členov', () => {
    const result = preferenceConflicts(recipe(['huby', 'mlieko']), [ema], 'all')
    expect(result.map((w) => w.kind)).toEqual(['allergy', 'dislike'])
  })

  it('diéta hlási recept, ktorý nemá požadovaný tag', () => {
    expect(preferenceConflicts(recipe(['muka']), [tato], 'all')).toEqual([
      { memberId: 't', memberName: 'Tato', kind: 'diet', label: 'Vegetariánske' },
    ])
    expect(preferenceConflicts(recipe(['muka'], ['vegetarian']), [tato], 'all')).toEqual([])
  })

  it('berie do úvahy len členov, ktorých sa jedlo týka', () => {
    const all = [mama, ema, tato]
    const r = recipe(['orechy', 'mlieko'])
    expect(preferenceConflicts(r, all, 'adults').map((w) => w.memberName)).toEqual(['Mama', 'Tato'])
    expect(preferenceConflicts(r, all, 'children').map((w) => w.memberName)).toEqual(['Ema'])
    expect(preferenceConflicts(r, all, 'custom').map((w) => w.memberName)).toEqual(['Mama', 'Ema', 'Tato'])
  })

  it('neaktívny člen sa neberie do úvahy', () => {
    const away = member('a', 'Babka', 'adult', [allergy('orechy', 'Orechy')], false)
    expect(preferenceConflicts(recipe(['orechy']), [away], 'all')).toEqual([])
  })

  it('preferencia bez ingrediencie aj tagu (zmazaná) sa ignoruje', () => {
    const broken = member('b', 'Bob', 'adult', [
      { kind: 'allergy', ingredientId: null, tagId: null, label: '' },
    ])
    expect(preferenceConflicts(recipe(['orechy']), [broken], 'all')).toEqual([])
  })

  it('rovnakú ingredienciu nahlási raz, aj keď je v recepte viackrát', () => {
    expect(preferenceConflicts(recipe(['orechy', 'orechy']), [mama], 'all')).toHaveLength(1)
  })
})

describe('describeWarning', () => {
  it('opíše každý druh upozornenia po slovensky', () => {
    expect(describeWarning({ memberId: 'm', memberName: 'Mama', kind: 'allergy', label: 'Orechy' })).toBe(
      'Mama: alergia na Orechy',
    )
    expect(describeWarning({ memberId: 'e', memberName: 'Ema', kind: 'dislike', label: 'Huby' })).toBe(
      'Ema: averzia na Huby',
    )
    expect(describeWarning({ memberId: 't', memberName: 'Tato', kind: 'diet', label: 'Vegetariánske' })).toBe(
      'Tato: recept nie je „Vegetariánske“',
    )
  })
})
