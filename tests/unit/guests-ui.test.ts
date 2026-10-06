import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FamilyMemberDto, PlanEntryDto } from '@shared/api'
import FamilyPage from '@/features/family/pages/FamilyPage.vue'
import PlanEntryCard from '@/features/meal-plan/components/PlanEntryCard.vue'
import { createAppVuetify } from '@/plugins/vuetify'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

const person = (over: Partial<FamilyMemberDto> & { id: string; name: string }): FamilyMemberDto => ({
  kind: 'adult',
  birthDate: null,
  portionFactor: 1,
  color: '#B4532A',
  isActive: true,
  sortOrder: 0,
  preferences: [],
  ...over,
})

const anna = person({ id: 'm1', name: 'Anna' })
const teta = person({ id: 'g1', name: 'Teta Eva', kind: 'guest' })

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('Rodina s návštevami', () => {
  it('návštevy sú v samostatnej skupine a nepočítajú sa do porcií rodiny', async () => {
    stubApi({ '/me': { ...me('owner'), members: [anna, teta] } })
    const wrapper = mount(FamilyPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
    await flushPromises()
    const heading = wrapper.find('[data-test="guests-heading"]')
    expect(heading.text()).toBe('Návštevy')
    expect(wrapper.text()).toContain('Návšteva · porcia 1')
    expect(wrapper.text()).toContain('Na jedno jedlo pre celú rodinu: 1 porcia')
  })

  it('bez návštev sa skupina Návštevy nezobrazí', async () => {
    stubApi({ '/me': { ...me('owner'), members: [anna] } })
    const wrapper = mount(FamilyPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
    await flushPromises()
    expect(wrapper.find('[data-test="guests-heading"]').exists()).toBe(false)
  })
})

describe('karta jedla s návštevou', () => {
  const entry = (guestIds: string[]): PlanEntryDto => ({
    id: 'e1',
    date: '2026-10-06',
    slotId: 's1',
    recipeId: null,
    recipe: null,
    freeText: 'Obed',
    servingsOverride: null,
    note: null,
    sortOrder: 0,
    audience: 'all',
    guestIds,
    presentGuestIds: guestIds,
    warnings: [],
  })

  it('ukáže mená vybraných návštev a počíta ich do porcií', () => {
    const wrapper = mount(PlanEntryCard, {
      props: { entry: entry(['g1']), members: [anna, teta] },
      global: { plugins: [createAppVuetify()] },
    })
    expect(wrapper.text()).toContain('2 porc.')
    expect(wrapper.text()).toContain('Návšteva: Teta Eva')
  })

  it('bez vybranej návštevy ju neukáže ani nepočíta', () => {
    const wrapper = mount(PlanEntryCard, {
      props: { entry: entry([]), members: [anna, teta] },
      global: { plugins: [createAppVuetify()] },
    })
    expect(wrapper.text()).toContain('1 porc.')
    expect(wrapper.text()).not.toContain('Návšteva')
  })
})
