import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { RecipeDetailDto } from '@shared/api'
import RecipeDetailPage from '@/features/recipes/pages/RecipeDetailPage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const pizza: RecipeDetailDto = {
  id: 'r1',
  title: 'Rodinná pizza',
  slug: 'rodinna-pizza',
  category: 'hlavne',
  servings: 4,
  prepMinutes: null,
  cookMinutes: null,
  difficulty: 2,
  coverImageUrl: '/img/h/pizza.webp',
  tags: [{ id: 't1', name: 'Recepty zo života', color: null }],
  isFavorite: false,
  isVerified: true,
  visibility: 'private',
  createdAt: 'x',
  updatedAt: 'x',
  lastCookedAt: null,
  description: null,
  sourceUrl: null,
  sourceText: 'Recepty zo života, s. 171',
  coverImageId: 'c1',
  shareToken: null,
  ingredients: [],
  steps: [{ id: 's1', position: 1, text: 'Upeč.', timerSeconds: null }],
}
const Blank = defineComponent({ render: () => h('div') })

async function mountDetail(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  stubApi({ '/me': me('owner'), '/recipes/r1': pizza })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/recipes/:id', component: Blank }],
  })
  await router.push('/recipes/r1')
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(RecipeDetailPage)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return wrapper
}

describe('detail receptu na počítači (rozloženie B)', () => {
  it('hlavička na celú šírku: fotka vľavo, názov, údaje so zdrojom a akcie', async () => {
    const wrapper = await mountDetail(1440)
    const header = wrapper.find('[data-test="recipe-header"]')
    expect(header.exists()).toBe(true)
    expect(header.find('[data-test="recipe-cover"]').exists()).toBe(true)
    expect(header.find('h1').text()).toBe('Rodinná pizza')
    const facts = header.find('[data-test="recipe-facts"]').text()
    expect(facts).toContain('Porcie')
    expect(facts).toContain('Stredné')
    expect(facts).toContain('Recepty zo života, s. 171')
    expect(header.find('[data-test="verified-switch"]').exists()).toBe(true)
    expect(header.text()).toContain('Režim varenia')
    // Zdroj je na počítači v hlavičke, nie znova dole.
    expect(wrapper.find('[data-test="recipe-source"]').exists()).toBe(false)
  })

  it('na mobile ostáva doterajší detail bez hlavičky', async () => {
    const wrapper = await mountDetail(390)
    expect(wrapper.find('[data-test="recipe-header"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="recipe-source"]').exists()).toBe(true)
  })
})
