import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SuggestionDto } from '@shared/api'
import type { UserSettingsDto } from '@shared/userSettings'
import SuggestionsCard from '@/features/meal-plan/components/SuggestionsCard.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
}

const suggestion = (n: number): SuggestionDto => ({
  recipeId: `r${n}`,
  title: `Recept ${n}`,
  coverImageUrl: null,
  totalMinutes: 30,
  score: 10 - n,
  reasons: ['Chýba: cibuľa', 'Zatiaľ nevarené'],
  missing: ['cibuľa'],
})

async function mountCard(width: number, userSettings: UserSettingsDto = {}) {
  setViewport(width)
  const calls = stubApi({
    '/me': { ...me('owner'), userSettings },
    '/recipes/suggestions': [1, 2, 3, 4, 5].map(suggestion),
    'PUT /me/settings': { planSuggestionsOpen: false },
  })
  const wrapper = mount(SuggestionsCard, {
    props: { date: '2026-10-07' },
    global: { plugins: mountPlugins(), stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    attachTo: document.body,
  })
  await flushPromises()
  return { calls, wrapper }
}

describe('Čo uvariť dnes', () => {
  it('na mobile ukáže tri návrhy pod sebou, ďalšie až na požiadanie', async () => {
    const { wrapper } = await mountCard(390)
    expect(wrapper.findAll('[data-test="suggestion-row"]')).toHaveLength(3)
    expect(wrapper.find('[data-test="suggestion"]').exists()).toBe(false)
    await wrapper.find('[data-test="suggestions-more"]').trigger('click')
    expect(wrapper.findAll('[data-test="suggestion-row"]')).toHaveLength(5)
  })

  it('riadok na mobile má len názov, čas, čo chýba a tlačidlo naplánovať', async () => {
    const { wrapper } = await mountCard(390)
    const row = wrapper.find('[data-test="suggestion-row"]')
    expect(row.text()).toContain('Recept 1')
    expect(row.text()).toContain('Chýba: cibuľa')
    expect(row.text()).not.toContain('Zatiaľ nevarené')
    await row.find('[data-test="suggestion-plan"]').trigger('click')
    expect(wrapper.emitted('plan')).toEqual([['r1']])
  })

  it('na počítači ostanú karty vedľa seba', async () => {
    const { wrapper } = await mountCard(1280)
    expect(wrapper.findAll('[data-test="suggestion"]').length).toBeGreaterThan(0)
  })

  it('zbalenie sa uloží do nastavení človeka a platí aj neskôr', async () => {
    const { calls, wrapper } = await mountCard(390)
    await wrapper.find('[data-test="suggestions-toggle"]').trigger('click')
    await flushPromises()
    const put = calls.find((c) => c.method === 'PUT' && c.path === '/me/settings')
    expect(put?.body).toEqual({ planSuggestionsOpen: false })

    const closed = await mountCard(390, { planSuggestionsOpen: false })
    expect(closed.wrapper.find('[data-test="suggestion-row"]').isVisible()).toBe(false)
  })
})
