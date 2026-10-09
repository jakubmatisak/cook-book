import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { VApp } from 'vuetify/components'
import type { PlanEntryDto } from '@shared/api'
import type { ComposeItem, ComposeOption } from '@shared/compose'
import ComposeWizard from '@/features/meal-plan/components/ComposeWizard.vue'
import PlanEntryCard from '@/features/meal-plan/components/PlanEntryCard.vue'
import { jsonResponse, me, mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const MON = '2026-10-12'
const TUE = '2026-10-13'

const option = (recipeId: string, title: string): ComposeOption => ({
  recipeId,
  title,
  coverImageUrl: null,
  totalMinutes: 25,
  category: 'hlavne',
  warnings: [],
})

const item = (date: string, opt: ComposeOption, options: ComposeOption[]): ComposeItem => ({
  key: `${date}|s1|main`,
  date,
  slotId: 's1',
  course: 'main',
  recipeId: opt.recipeId,
  title: opt.title,
  coverImageUrl: null,
  totalMinutes: 25,
  category: 'hlavne',
  leftoverOf: null,
  leftoverDays: 0,
  warnings: [],
  options,
  repeatsOn: [],
})

const gulas = option('r1', 'Guláš')
const rezen = option('r2', 'Rezeň')
const ryza = option('r3', 'Rizoto')
const proposal = [
  item(MON, gulas, [gulas, rezen, ryza]),
  {
    ...item(TUE, rezen, [rezen, gulas]),
    warnings: [{ memberId: 'm1', memberName: 'Peter', kind: 'dislike_recipe' as const, label: 'Rezeň' }],
  },
]

const q = (selector: string) => document.body.querySelector<HTMLElement>(selector)
async function click(selector: string) {
  const el = q(selector)
  if (!el) throw new Error(`Chýba ${selector}`)
  el.click()
  await flushPromises()
}

function mountWizard() {
  const calls = stubApi({
    '/me': me('owner'),
    '/plan': [],
    '/plan/stays': [],
    '/tags': [],
    '/recipes': { items: [], facets: { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} } },
    'POST /plan/compose': proposal,
    'POST /plan/compose/apply': () => jsonResponse({ added: 2 }, 201),
  })
  const onApplied = vi.fn()
  mount(
    {
      render: () =>
        h(VApp, null, () =>
          h(ComposeWizard, {
            modelValue: true,
            weekStart: MON,
            today: MON,
            weekStartsOn: 1,
            slots: me('owner').slots,
            members: [],
            onApplied,
          }),
        ),
    },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  return { calls, onApplied }
}

describe('sprievodca Zostaviť jedálniček', () => {
  it('prejde krokmi: rozsah a jedlá, maľovanie štetcom, kontrola s iným návrhom a zvyškami, potvrdenie', async () => {
    const { calls, onApplied } = mountWizard()
    await flushPromises()

    // Krok 1: dva dni, len obed, bez varenia na viac dní
    const to = q('[data-test="compose-to"] input') as HTMLInputElement
    to.value = TUE
    to.dispatchEvent(new Event('input'))
    await click('[data-test="compose-slot-s2"] input')
    await click('[data-test="compose-leftovers"] input')
    await click('[data-test="compose-next"]')

    // Krok 2: mriežka len pre obed; štetec Overené na pondelok, pracovné dni do 30 min
    expect(q(`[data-test="cell-${MON}-s1"]`)).not.toBeNull()
    expect(q(`[data-test="cell-${MON}-s2"]`)).toBeNull()
    await click('[data-test="brush-verified"]')
    await click(`[data-test="cell-${MON}-s1"]`)
    expect(q(`[data-test="cell-${MON}-s1"]`)!.textContent).toContain('Overené')
    expect(q('[data-test="compose-summary"]')!.textContent).toContain(
      'Naplní sa 2 políčka: 1× Všetky, 1× Overené',
    )
    await click('[data-test="preset-workdays"]')
    await click('[data-test="compose-next"]')

    const request = calls.find((c) => c.method === 'POST' && c.path === '/plan/compose')!
    expect(request.body).toMatchObject({
      cells: [
        { date: MON, slotId: 's1', brush: 'verified' },
        { date: TUE, slotId: 's1', brush: 'all' },
      ],
      slots: [{ slotId: 's1', categories: ['hlavne'], withSoup: false }],
      timeLimits: { [MON]: 'do30', [TUE]: 'do30' },
      leftoverDays: 0,
      replace: false,
    })

    // Krok 3: návrh, upozornenie, iný návrh (Rezeň už je v utorok → Rizoto) a zvyšky +1
    expect(q('[data-test="compose-review"]')!.textContent).toContain('Guláš')
    expect(q(`[data-test="review-item-${TUE}|s1|main"]`)!.textContent).toContain('Peter')
    await click(`[data-test="other-${MON}|s1|main"]`)
    expect(q(`[data-test="review-item-${MON}|s1|main"]`)!.textContent).toContain('Rizoto')
    await click(`[data-test="leftover-${MON}|s1|main-1"]`)
    expect(q(`[data-test="review-item-${TUE}|s1|main"]`)!.textContent).toContain('Zvyšky z PO')
    expect(q(`[data-test="review-item-${TUE}|s1|main"]`)!.textContent).toContain('Rizoto')

    await click('[data-test="compose-confirm"]')
    const applied = calls.find((c) => c.path === '/plan/compose/apply')!
    expect(applied.body).toEqual({
      replace: false,
      items: [
        { key: `${MON}|s1|main`, date: MON, slotId: 's1', recipeId: 'r3', leftoverOf: null, leftoverDays: 1 },
        {
          key: `${TUE}|s1|main`,
          date: TUE,
          slotId: 's1',
          recipeId: 'r3',
          leftoverOf: `${MON}|s1|main`,
          leftoverDays: 0,
        },
      ],
    })
    expect(onApplied).toHaveBeenCalledWith(2, MON)
  })

  it('neplatný rozsah nepustí ďalej', async () => {
    mountWizard()
    await flushPromises()
    const to = q('[data-test="compose-to"] input') as HTMLInputElement
    to.value = '2026-10-30'
    to.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(document.body.textContent).toContain('najviac 14 dní')
    expect(q('[data-test="compose-next"]')!.hasAttribute('disabled')).toBe(true)
  })
})

describe('zvyšky v jedálničku', () => {
  it('karta zvyškov má odznak Zvyšky', () => {
    const entry = {
      id: 'e2',
      date: TUE,
      slotId: 's1',
      recipeId: 'r1',
      recipe: { id: 'r1', title: 'Guláš', servings: 4, category: 'hlavne', deleted: false },
      freeText: null,
      servingsOverride: null,
      note: null,
      audience: 'all',
      guestIds: [],
      presentGuestIds: [],
      warnings: [],
      sortOrder: 0,
      leftoverOfEntryId: 'e1',
    } as unknown as PlanEntryDto
    const wrapper = mount(PlanEntryCard, {
      props: { entry, members: [] },
      global: { plugins: mountPlugins() },
    })
    expect(wrapper.find('[data-test="leftover-badge"]').text()).toBe('Zvyšky')
  })
})
