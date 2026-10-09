import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import RecipesPage from '@/features/recipes/pages/RecipesPage.vue'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

vi.setConfig({ testTimeout: 20_000 })
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }))

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
})

describe('panel filtrov na počítači', () => {
  it('ostane otvorený po zaškrtnutí kategórie (zmena adresy ho nezavrie)', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    stubApi({
      '/me': me('owner'),
      '/tags': [],
      '/recipes': {
        items: [],
        facets: { category: { polievka: 2, hlavne: 3 }, tag: {}, difficulty: {}, time: {}, missing: {} },
      },
    })
    const Blank = defineComponent({ render: () => h('div') })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/recipes', component: Blank }],
    })
    await router.push('/recipes')
    await router.isReady()
    const wrapper = mount(
      { render: () => h(VApp, null, () => h(RecipesPage)) },
      { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
    )
    await flushPromises()
    await wrapper.find('[data-test="filters-button"]').trigger('click')
    await flushPromises()
    const drawer = () => document.querySelector('.v-navigation-drawer--right')!
    expect(drawer().classList.contains('v-navigation-drawer--active')).toBe(true)
    const soup = [...drawer().querySelectorAll<HTMLElement>('.v-list-item, label')].find((e) =>
      e.textContent?.includes('Polievka'),
    )!
    soup.click()
    await flushPromises()
    await vi.waitFor(() => expect(router.currentRoute.value.query.category).toBe('soup'))
    await flushPromises()
    expect(drawer().classList.contains('v-navigation-drawer--active')).toBe(true)
  })
})
