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

async function mountPage(url = '/recepty', kidsEnabled?: boolean) {
  stubApi({
    '/me': { ...me('owner'), userSettings: kidsEnabled === undefined ? {} : { kidsEnabled } },
    '/recipes': emptyList,
    '/tags': [],
  })
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

describe('prepínač detských receptov', () => {
  it('predvolene sú detské skryté; „Aj detské“ pošle kids=1 a „Len detské“ kids=only', async () => {
    const { router, wrapper } = await mountPage()
    expect(requested().every((u) => !u.includes('kids='))).toBe(true)

    await wrapper.find('[data-test="kids-include"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.detske).toBe('1'))
    await vi.waitFor(() => expect(requested().some((u) => u.includes('kids=1'))).toBe(true))

    await wrapper.find('[data-test="kids-only"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.detske).toBe('len'))
    await vi.waitFor(() => expect(requested().some((u) => u.includes('kids=only'))).toBe(true))

    await wrapper.find('[data-test="kids-hide"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.detske).toBeUndefined())
  })

  it('z adresy sa zvolí príslušná možnosť', async () => {
    const { wrapper } = await mountPage('/recepty?detske=len')
    expect(requested().some((u) => u.includes('kids=only'))).toBe(true)
    expect(wrapper.find('[data-test="kids-only"]').classes()).toContain('bg-primary')
  })

  it('v angličtine majú možnosti anglické popisy', async () => {
    setLocale('en')
    const { wrapper } = await mountPage()
    expect(wrapper.find('[data-test="kids-hide"]').text()).toBe('No baby food')
    expect(wrapper.find('[data-test="kids-include"]').text()).toBe('With baby food')
    expect(wrapper.find('[data-test="kids-only"]').text()).toBe('Baby food only')
  })
})

describe('vypnuté detské jedlá v nastaveniach', () => {
  it('prepínač sa nezobrazí a kids sa neposiela, ani keď je v adrese', async () => {
    const { wrapper } = await mountPage('/recepty?detske=1', false)
    expect(wrapper.find('[data-test="kids-toggle"]').exists()).toBe(false)
    expect(requested().every((u) => !u.includes('kids='))).toBe(true)
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
