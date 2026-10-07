import { describe, expect, it } from 'vitest'
import { legacyRedirect, translateLegacyQuery } from '@/router/legacy'

describe('staré slovenské adresy', () => {
  it('cesty sa preložia na anglické', () => {
    const cases: [string, string][] = [
      ['/recepty', '/recipes'],
      ['/recepty/novy', '/recipes/new'],
      ['/recepty/import', '/recipes/import'],
      ['/recepty/r1', '/recipes/r1'],
      ['/recepty/r1/upravit', '/recipes/r1/edit'],
      ['/recepty/r1/varenie', '/recipes/r1/cook'],
      ['/verejne/r1', '/public/r1'],
      ['/nakup', '/shopping'],
      ['/spajza', '/pantry'],
      ['/rodina', '/people'],
      ['/ingrediencie', '/ingredients'],
      ['/tagy', '/tags'],
      ['/nastavenia', '/settings'],
      ['/viac', '/settings'],
    ]
    for (const [from, to] of cases) expect(legacyRedirect(from, {})?.path, from).toBe(to)
  })

  it('parametre a ich hodnoty sa preložia, ostatné ostanú', () => {
    expect(
      legacyRedirect('/recepty', {
        kategoria: 'dezert,hlavne',
        cas: 'do30',
        narocnost: '1',
        oblubene: '1',
        detske: 'len',
        verejne: '1',
        doma: '1',
        chyba: '1',
        zoradit: 'time',
        smer: 'desc',
        q: 'guláš',
        tag: 't1',
      }),
    ).toEqual({
      path: '/recipes',
      query: {
        category: 'dessert,main',
        time: 'under30',
        difficulty: '1',
        favorites: '1',
        kids: 'only',
        public: 'include',
        pantry: '1',
        missing: '1',
        sort: 'time',
        dir: 'desc',
        q: 'guláš',
        tag: 't1',
      },
    })
    expect(legacyRedirect('/recepty/r1', { porcie: '6' })).toEqual({
      path: '/recipes/r1',
      query: { servings: '6' },
    })
    expect(legacyRedirect('/plan', { tyzden: '2026-10-05' })).toEqual({
      path: '/plan',
      query: { week: '2026-10-05' },
    })
    expect(legacyRedirect('/recepty/import', { url: 'https://x.sk/a?b=1' })).toEqual({
      path: '/recipes/import',
      query: { url: 'https://x.sk/a?b=1' },
    })
  })

  it('stará adresa verejných receptov vedie na zoznam len cudzích receptov', () => {
    expect(legacyRedirect('/verejne', {})).toEqual({ path: '/recipes', query: { public: 'only' } })
  })

  it('nové adresy sa nepresmerúvajú', () => {
    expect(legacyRedirect('/recipes', { category: 'dessert' })).toBeNull()
    expect(legacyRedirect('/plan', {})).toBeNull()
    expect(legacyRedirect('/', {})).toBeNull()
  })

  it('uložené predvolené filtre so starými názvami sa preložia', () => {
    expect(translateLegacyQuery({ doma: '1', kategoria: 'polievka' })).toEqual({
      pantry: '1',
      category: 'soup',
    })
    expect(translateLegacyQuery({ pantry: '1' })).toEqual({ pantry: '1' })
  })
})
