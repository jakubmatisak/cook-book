import { describe, expect, it } from 'vitest'
import { composePlan, type ComposeCandidate, type ComposeContext, type ComposeRequest } from '@shared/compose'
import type { PreferenceMember } from '@shared/preferences'

const candidate = (id: string, over: Partial<ComposeCandidate> = {}): ComposeCandidate => ({
  id,
  title: id,
  coverImageUrl: null,
  isFavorite: false,
  isVerified: false,
  totalMinutes: 30,
  required: [],
  allIngredientIds: [],
  tagIds: [],
  lastCookedOn: '2026-08-01',
  category: 'hlavne',
  ...over,
})

const DAYS = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']

const ctx = (candidates: ComposeCandidate[], over: Partial<ComposeContext> = {}): ComposeContext => ({
  candidates,
  pantryIngredientIds: [],
  members: [],
  guestsOn: {},
  existing: [],
  recentRecipeIds: [],
  today: '2026-10-10',
  ...over,
})

const request = (over: Partial<ComposeRequest> = {}): ComposeRequest => ({
  cells: DAYS.map((date) => ({ date, slotId: 'obed', brush: 'all' })),
  slots: [{ slotId: 'obed', categories: ['hlavne'], withSoup: false }],
  timeLimits: {},
  tagIds: [],
  leftoverDays: 0,
  seed: 1,
  ...over,
})

const recipesOf = (items: ReturnType<typeof composePlan>) => items.map((i) => i.recipeId)

describe('composePlan – štetce a typy jedla', () => {
  it('hlavné jedlá sa v zostavení neopakujú a berie sa len typ jedla políčka', () => {
    const items = composePlan(
      request(),
      ctx([
        candidate('a'),
        candidate('b'),
        candidate('c'),
        candidate('d'),
        candidate('polievka', { category: 'polievka' }),
      ]),
    )
    expect(new Set(recipesOf(items)).size).toBe(4)
    expect(recipesOf(items)).not.toContain('polievka')
  })

  it('štetec Overené, Nové a Obľúbené vyberie len z danej množiny', () => {
    const all = [
      candidate('overeny', { isVerified: true }),
      candidate('novy', { lastCookedOn: null }),
      candidate('oblubeny', { isFavorite: true }),
      candidate('iny'),
    ]
    const items = composePlan(
      request({
        cells: [
          { date: DAYS[0]!, slotId: 'obed', brush: 'verified' },
          { date: DAYS[1]!, slotId: 'obed', brush: 'new' },
          { date: DAYS[2]!, slotId: 'obed', brush: 'favorite' },
        ],
      }),
      ctx(all),
    )
    expect(recipesOf(items)).toEqual(['overeny', 'novy', 'oblubeny'])
  })

  it('keď nič nevyhovuje, políčko ostane prázdne', () => {
    const items = composePlan(
      request({ cells: [{ date: DAYS[0]!, slotId: 'obed', brush: 'verified' }] }),
      ctx([candidate('a')]),
    )
    expect(items[0]!.recipeId).toBeNull()
  })

  it('obed s polievkou dostane polievku aj hlavné jedlo', () => {
    const items = composePlan(
      request({
        cells: [{ date: DAYS[0]!, slotId: 'obed', brush: 'all' }],
        slots: [{ slotId: 'obed', categories: ['hlavne'], withSoup: true }],
      }),
      ctx([candidate('gulas'), candidate('vyvar', { category: 'polievka' })]),
    )
    expect(items.map((i) => [i.course, i.recipeId])).toEqual([
      ['soup', 'vyvar'],
      ['main', 'gulas'],
    ])
  })

  it('raňajky sa opakovať môžu a opakovaný návrh vie, kedy už je', () => {
    const items = composePlan(
      request({
        cells: DAYS.slice(0, 2).map((date) => ({ date, slotId: 'ranajky', brush: 'all' as const })),
        slots: [{ slotId: 'ranajky', categories: ['ranajky'], withSoup: false }],
      }),
      ctx([candidate('kasa', { category: 'ranajky' })]),
    )
    expect(recipesOf(items)).toEqual(['kasa', 'kasa'])
    expect(items[1]!.repeatsOn).toEqual([DAYS[0]])
  })

  it('recept, ktorý už je v jedálničku v rozsahu, sa ako hlavné jedlo nenavrhne', () => {
    const items = composePlan(
      request({ cells: [{ date: DAYS[1]!, slotId: 'obed', brush: 'all' }] }),
      ctx([candidate('gulas'), candidate('rezen')], {
        existing: [{ date: DAYS[3]!, slotId: 'vecera', recipeId: 'gulas' }],
      }),
    )
    expect(recipesOf(items)).toEqual(['rezen'])
  })
})

describe('composePlan – čas a ľudia pri stole', () => {
  it('časový limit dňa vylúči dlhšie recepty; recept bez času ide až za známymi', () => {
    const items = composePlan(
      request({
        cells: [{ date: DAYS[0]!, slotId: 'obed', brush: 'all' }],
        timeLimits: { [DAYS[0]!]: 'do30' },
      }),
      ctx([
        candidate('dlhy', { totalMinutes: 90, isFavorite: true }),
        candidate('neznamy', { totalMinutes: null, isFavorite: true }),
        candidate('rychly', { totalMinutes: 25 }),
      ]),
    )
    expect(items[0]!.recipeId).toBe('rychly')
    expect(items[0]!.options.map((o) => o.recipeId)).toEqual(['rychly', 'neznamy'])
  })

  it('alergiu človeka pri stole nenavrhne nikdy; neobľúbené jedlo len keď nie je nič iné a upozorní', () => {
    const peter: PreferenceMember = {
      id: 'p',
      name: 'Peter',
      kind: 'adult',
      isActive: true,
      preferences: [
        { kind: 'allergy', ingredientId: 'orechy', tagId: null, label: 'Orechy' },
        { kind: 'dislike_recipe', ingredientId: null, tagId: null, recipeId: 'gulas', label: 'Guláš' },
      ],
    }
    const items = composePlan(
      request({ cells: DAYS.slice(0, 2).map((date) => ({ date, slotId: 'obed', brush: 'all' as const })) }),
      ctx([candidate('kolac', { allIngredientIds: ['orechy'] }), candidate('gulas'), candidate('rezen')], {
        members: [peter],
      }),
    )
    expect(recipesOf(items)).toEqual(['rezen', 'gulas'])
    expect(items[1]!.warnings.map((w) => [w.memberName, w.kind])).toEqual([['Peter', 'dislike_recipe']])
  })

  it('návšteva sa berie do úvahy len v dni pobytu', () => {
    const babka: PreferenceMember = {
      id: 'b',
      name: 'Babka',
      kind: 'guest',
      isActive: true,
      preferences: [{ kind: 'allergy', ingredientId: 'mlieko', tagId: null, label: 'Mlieko' }],
    }
    const items = composePlan(
      request({ cells: DAYS.slice(0, 2).map((date) => ({ date, slotId: 'obed', brush: 'all' as const })) }),
      ctx([candidate('omacka', { allIngredientIds: ['mlieko'], isFavorite: true }), candidate('rezen')], {
        members: [babka],
        guestsOn: { [DAYS[0]!]: ['b'] },
      }),
    )
    expect(items[0]!.recipeId).toBe('rezen')
    expect(items[1]!.recipeId).toBe('omacka')
  })
})

describe('composePlan – zvyšky', () => {
  it('uvarené jedlo s +1 dostane zvyšky na ďalší vybraný deň, aj cez vynechaný deň', () => {
    const items = composePlan(
      request({
        cells: [DAYS[0]!, DAYS[2]!, DAYS[3]!].map((date) => ({
          date,
          slotId: 'obed',
          brush: 'all' as const,
        })),
        leftoverDays: 1,
      }),
      ctx([candidate('gulas'), candidate('rezen')]),
    )
    expect(items.map((i) => [i.date, i.recipeId, i.leftoverOf !== null])).toEqual([
      [DAYS[0], items[0]!.recipeId, false],
      [DAYS[2], items[0]!.recipeId, true],
      [DAYS[3], items[2]!.recipeId, false],
    ])
    expect(items[0]!.leftoverDays).toBe(1)
    expect(items[1]!.leftoverOf).toBe(items[0]!.key)
    expect(items[2]!.recipeId).not.toBe(items[0]!.recipeId)
  })

  it('zvyšky sa neriadia časovým limitom a raňajky ich nemajú', () => {
    const items = composePlan(
      request({
        cells: DAYS.slice(0, 2).map((date) => ({ date, slotId: 'obed', brush: 'all' as const })),
        timeLimits: { [DAYS[1]!]: 'do30' },
        leftoverDays: 1,
      }),
      ctx([candidate('gulas', { totalMinutes: 120 })]),
    )
    expect(items[1]!.leftoverOf).toBe(items[0]!.key)

    const breakfast = composePlan(
      request({
        cells: DAYS.slice(0, 2).map((date) => ({ date, slotId: 'ranajky', brush: 'all' as const })),
        slots: [{ slotId: 'ranajky', categories: ['ranajky'], withSoup: false }],
        leftoverDays: 1,
      }),
      ctx([candidate('kasa', { category: 'ranajky' })]),
    )
    expect(breakfast.every((i) => i.leftoverOf === null)).toBe(true)
  })
})
