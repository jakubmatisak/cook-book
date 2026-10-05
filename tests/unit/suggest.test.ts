import { describe, expect, it } from 'vitest'
import type { PreferenceMember } from '@shared/preferences'
import { describeSince, scoreSuggestions, type SuggestCandidate } from '@shared/suggest'

const TODAY = '2026-10-05'

let seq = 0
const candidate = (title: string, extra: Partial<SuggestCandidate> = {}): SuggestCandidate => ({
  id: `r${++seq}`,
  title,
  coverImageUrl: null,
  isFavorite: false,
  totalMinutes: null,
  required: [],
  allIngredientIds: [],
  tagIds: [],
  lastCookedOn: null,
  ...extra,
})

const needs = (...names: string[]) => names.map((n) => ({ id: `i-${n}`, name: n }))
const ids = (...names: string[]) => names.map((n) => `i-${n}`)

const run = (candidates: SuggestCandidate[], extra: Partial<Parameters<typeof scoreSuggestions>[0]> = {}) =>
  scoreSuggestions({
    candidates,
    pantryIngredientIds: [],
    plannedRecipeIds: [],
    members: [],
    today: TODAY,
    ...extra,
  })

describe('describeSince', () => {
  it('opíše, kedy sa naposledy varilo, po slovensky', () => {
    expect(describeSince(0)).toBe('Varené dnes')
    expect(describeSince(1)).toBe('Naposledy včera')
    expect(describeSince(5)).toBe('Naposledy pred 5 dňami')
    expect(describeSince(13)).toBe('Naposledy pred 13 dňami')
    expect(describeSince(14)).toBe('Naposledy pred 2 týždňami')
    expect(describeSince(35)).toBe('Naposledy pred 5 týždňami')
    expect(describeSince(60)).toBe('Naposledy pred 2 mesiacmi')
    expect(describeSince(400)).toBe('Naposledy pred viac ako rokom')
  })
})

describe('scoreSuggestions', () => {
  it('recept, na ktorý je všetko doma, predbehne ten, čomu veľa chýba', () => {
    const doma = candidate('Praženica', {
      required: needs('vajcia', 'cibula'),
      allIngredientIds: ids('vajcia', 'cibula'),
    })
    const chyba = candidate('Guláš', {
      required: needs('maso', 'cibula', 'paprika'),
      allIngredientIds: ids('maso', 'cibula', 'paprika'),
    })
    const result = run([chyba, doma], { pantryIngredientIds: ids('vajcia', 'cibula') })
    expect(result.map((s) => s.title)).toEqual(['Praženica', 'Guláš'])
    expect(result[0]!.reasons).toContain('Máš všetko doma')
    expect(result[1]!.missing).toEqual(['maso', 'paprika'])
    expect(result[1]!.reasons).toContain('Chýba: maso, paprika')
  })

  it('dlhšie nevarené predbehne nedávno varené a nikdy nevarené je medzi nimi', () => {
    const recent = candidate('Včerajšie', { lastCookedOn: '2026-10-04' })
    const old = candidate('Staré', { lastCookedOn: '2026-07-01' })
    const never = candidate('Nové')
    const result = run([recent, never, old])
    expect(result.map((s) => s.title)).toEqual(['Staré', 'Nové', 'Včerajšie'])
    expect(result.find((s) => s.title === 'Nové')!.reasons).toContain('Zatiaľ nevarené')
    expect(result.find((s) => s.title === 'Staré')!.reasons).toContain('Naposledy pred 3 mesiacmi')
  })

  it('obľúbené dostane bonus a dôvod', () => {
    const plain = candidate('Obyčajné')
    const fav = candidate('Obľúbené', { isFavorite: true })
    const result = run([plain, fav])
    expect(result[0]!.title).toBe('Obľúbené')
    expect(result[0]!.reasons).toContain('Obľúbené')
  })

  it('vylúči už naplánované recepty a recepty s alergénom, averzia len znižuje poradie', () => {
    const planned = candidate('Naplánované')
    const allergic = candidate('Orechový', { allIngredientIds: ids('orechy'), required: needs('orechy') })
    const disliked = candidate('Hubový', { allIngredientIds: ids('huby'), required: needs('huby') })
    const plain = candidate('Obyčajné')
    const members: PreferenceMember[] = [
      {
        id: 'm',
        name: 'Mama',
        kind: 'adult',
        isActive: true,
        preferences: [
          { kind: 'allergy', ingredientId: 'i-orechy', tagId: null, label: 'Orechy' },
          { kind: 'dislike', ingredientId: 'i-huby', tagId: null, label: 'Huby' },
        ],
      },
    ]
    const result = run([planned, allergic, disliked, plain], {
      plannedRecipeIds: [planned.id],
      members,
      pantryIngredientIds: ids('huby'),
    })
    expect(result.map((s) => s.title)).toEqual(['Obyčajné', 'Hubový'])
  })

  it('recept bez ingrediencií počíta ako s kompletným vybavením, ale nehlási „máš všetko“', () => {
    const [only] = run([candidate('Prázdny')])
    expect(only!.reasons).not.toContain('Máš všetko doma')
    expect(only!.missing).toEqual([])
  })

  it('vráti najviac `limit` návrhov (predvolene 6) a pri rovnakom skóre podľa názvu', () => {
    const many = Array.from({ length: 10 }, (_, i) => candidate(`Recept ${String.fromCharCode(74 - i)}`))
    const result = run(many)
    expect(result).toHaveLength(6)
    expect(result.map((s) => s.title)).toEqual([
      'Recept A',
      'Recept B',
      'Recept C',
      'Recept D',
      'Recept E',
      'Recept F',
    ])
    expect(run(many, { limit: 3 })).toHaveLength(3)
  })

  it('čas prípravy a obrázok sa prenesú do návrhu', () => {
    const [s] = run([candidate('Rýchle', { totalMinutes: 25, coverImageUrl: '/img/x.png' })])
    expect(s).toMatchObject({ title: 'Rýchle', totalMinutes: 25, coverImageUrl: '/img/x.png' })
  })
})
