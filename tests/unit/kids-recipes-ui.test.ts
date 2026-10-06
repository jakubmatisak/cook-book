import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import RecipesPage from '@/features/recipes/pages/RecipesPage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

const emptyList = { items: [], facets: { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} } }
const Blank = defineComponent({ render: () => h('div') })

async function mountPage(url = '/recepty') {
  stubApi({ '/me': me('owner'), '/recipes': emptyList, '/tags': [] })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/recepty', component: Blank }],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(RecipesPage)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return { router, wrapper }
}

const requested = () =>
  (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    .map((c) => String(c[0]))
    .filter((u) => u.includes('/recipes') && !u.includes('/recipes/'))

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('prepínač „Aj detské“', () => {
  it('je vypnutý, kým ho nezapneš, a zapnutie pošle kids=1 aj uloží detske=1 do adresy', async () => {
    const { router, wrapper } = await mountPage()
    expect(requested().every((u) => !u.includes('kids=1'))).toBe(true)

    await wrapper.find('[data-test="kids-toggle"]').trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(router.currentRoute.value.query.detske).toBe('1'))
    await vi.waitFor(() => expect(requested().some((u) => u.includes('kids=1'))).toBe(true))

    await wrapper.find('[data-test="kids-toggle"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.detske).toBeUndefined())
  })

  it('z adresy detske=1 sa zapne hneď', async () => {
    const { wrapper } = await mountPage('/recepty?detske=1')
    expect(requested().some((u) => u.includes('kids=1'))).toBe(true)
    expect(wrapper.find('[data-test="kids-toggle"]').classes()).toContain('bg-primary')
  })

  it('v angličtine má popis po anglicky', async () => {
    setLocale('en')
    const { wrapper } = await mountPage()
    expect(wrapper.find('[data-test="kids-toggle"]').text()).toBe('Include baby food')
  })
})

describe('hlavička zoznamu receptov', () => {
  it('nadpis, hľadanie a filtre sú v lepkavej hlavičke, posúva sa len zoznam', async () => {
    const { wrapper } = await mountPage()
    const sticky = wrapper.find('[data-test="sticky-header"]')
    expect(sticky.exists()).toBe(true)
    expect(sticky.find('input').exists()).toBe(true)
    expect(sticky.find('[data-test="filters-button"]').exists()).toBe(true)
  })
})
