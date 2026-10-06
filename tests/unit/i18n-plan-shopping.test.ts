import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { FamilyMemberDto, PlanEntryDto, ShoppingItemDto, SuggestionDto } from '@shared/api'
import MealPlanPage from '@/features/meal-plan/pages/MealPlanPage.vue'
import PlanEntryCard from '@/features/meal-plan/components/PlanEntryCard.vue'
import SuggestionsCard from '@/features/meal-plan/components/SuggestionsCard.vue'
import { describeReason } from '@/features/meal-plan/reasons'
import ShoppingPage from '@/features/shopping/pages/ShoppingPage.vue'
import { setLocale } from '@/i18n'
import { createAppVuetify } from '@/plugins/vuetify'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

// jsdom nemá IndexedDB, ktorý používa fronta odškrtnutí bez signálu.
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }))

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const router = () =>
  createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] })

const item = (over: Partial<ShoppingItemDto> & { id: string; name: string }): ShoppingItemDto => ({
  listId: 'l1',
  ingredientId: null,
  quantity: null,
  unit: null,
  shopCategoryId: null,
  isChecked: false,
  checkedAt: null,
  source: 'manual',
  sources: [],
  updatedAt: '2026-10-05T10:00:00Z',
  ...over,
})

const suggestion = (reasons: string[]): SuggestionDto => ({
  recipeId: 'r1',
  title: 'Guláš',
  coverImageUrl: null,
  totalMinutes: 90,
  score: 70,
  reasons,
  missing: [],
})

describe('plán a nákup v angličtine', () => {
  it('nákupný zoznam je po anglicky', async () => {
    setLocale('en')
    stubApi({
      '/me': me('owner'),
      '/shopping/lists': [{ id: 'l1', name: 'Nákup', isDefault: true }],
      '/shopping/lists/l1/items': [
        item({ id: 'i1', name: 'Milk', source: 'staple' }),
        item({ id: 'i2', name: 'Bread', isChecked: true }),
      ],
      '/shop-categories': [],
    })
    const wrapper = mount(ShoppingPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('Shopping list')
    expect(text).toContain('1 item to buy · 1 in cart')
    expect(text).toContain('From meal plan')
    expect(text).toContain('Staple item')
    expect(text).toContain('Other')
    expect(text).toContain('In cart (1)')
    expect(text).not.toContain('Nákupný zoznam')
    expect(text).not.toContain('Stála položka')
  })

  it('jedálniček je po anglicky a bez rodiny ukáže odkaz', async () => {
    setLocale('en')
    stubApi({ '/me': me('owner'), '/plan': [], '/recipes/suggestions': [] })
    const r = router()
    const wrapper = mount(MealPlanPage, {
      global: { plugins: [...mountPlugins(), r] },
      attachTo: document.body,
    })
    await r.isReady()
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('Meal plan')
    expect(text).toContain(
      'Add family members in the Family section and portions will be calculated automatically.',
    )
    expect(wrapper.find('a[href="/rodina"]').text()).toBe('Family')
    expect(wrapper.find('[aria-label="Previous week"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Next week"]').exists()).toBe(true)
    expect(text).not.toContain('Jedálniček')
    expect(text).not.toContain('Pridaj členov')
  })

  it('návrhy: dôvody zo servera sa preložia, v slovenčine ostanú nezmenené', async () => {
    const reasons = ['Chýba: Mlieko, Múka', 'Naposledy pred 3 týždňami', 'Obľúbené', 'Anna: averzia na Huby']
    stubApi({ '/recipes/suggestions': [suggestion(reasons)] })
    const sk = mount(SuggestionsCard, { props: { date: '2026-10-06' }, global: { plugins: mountPlugins() } })
    await flushPromises()
    expect(sk.text()).toContain('Čo uvariť dnes')
    for (const reason of reasons.slice(0, 3)) expect(sk.text()).toContain(reason)
    sk.unmount()

    setLocale('en')
    const en = mount(SuggestionsCard, { props: { date: '2026-10-06' }, global: { plugins: mountPlugins() } })
    await flushPromises()
    const text = en.text()
    expect(text).toContain('What to cook today')
    expect(text).toContain('Missing: Mlieko, Múka')
    expect(text).toContain('Last cooked 3 weeks ago')
    expect(text).toContain('Favorite')
    expect(text).not.toContain('Naposledy')
    expect(text).toContain('1 h 30 min')
  })

  it('describeReason pozná všetky dôvody a farby', () => {
    expect(describeReason('Máš všetko doma')).toEqual({ text: 'Máš všetko doma', color: 'success' })
    expect(describeReason('Neznámy dôvod')).toEqual({ text: 'Neznámy dôvod', color: undefined })
    setLocale('en')
    expect(describeReason('Máš všetko doma')).toEqual({
      text: 'You have everything at home',
      color: 'success',
    })
    expect(describeReason('Chýba: Soľ…').color).toBe('warning')
    expect(describeReason('Varené dnes').text).toBe('Cooked today')
    expect(describeReason('Naposledy pred 2 dňami').text).toBe('Last cooked 2 days ago')
    expect(describeReason('Naposledy pred viac ako rokom').text).toBe('Last cooked over a year ago')
    expect(describeReason('Zatiaľ nevarené').text).toBe('Not cooked yet')
    expect(describeReason('Teta Eva: averzia na Huby').text).toBe('Teta Eva: dislikes Huby')
  })

  it('karta jedla: porcie, návšteva a upozornenie po anglicky', () => {
    setLocale('en')
    const guest: FamilyMemberDto = {
      id: 'g1',
      name: 'Aunt Eva',
      kind: 'guest',
      birthDate: null,
      portionFactor: 1,
      color: '#B4532A',
      isActive: true,
      sortOrder: 0,
      preferences: [],
    }
    const entry: PlanEntryDto = {
      id: 'e1',
      date: '2026-10-06',
      slotId: 's1',
      recipeId: null,
      recipe: null,
      freeText: 'Lunch',
      servingsOverride: 1.5,
      note: null,
      sortOrder: 0,
      audience: 'all',
      guestIds: ['g1'],
      warnings: [{ kind: 'allergy', memberId: 'm1', memberName: 'Anna', label: 'peanuts' }],
    }
    const wrapper = mount(PlanEntryCard, {
      props: { entry, members: [guest] },
      global: { plugins: [createAppVuetify()] },
    })
    expect(wrapper.text()).toContain('1.5 serv.')
    expect(wrapper.text()).toContain('Guests: Aunt Eva')
    expect(wrapper.attributes('aria-label')).toBe('Edit: Lunch')
    expect(wrapper.find('[data-test="entry-warning"]').attributes('aria-label')).toBe(
      'Anna: allergic to peanuts',
    )
  })
})
