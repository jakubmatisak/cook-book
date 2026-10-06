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

/** Rozbaľovacie pole: otvorí ponuku a vyberie možnosť podľa textu. */
async function chooseKids(wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'], text: string) {
  await wrapper.find('[data-test="kids-select"] .v-field').trigger('mousedown')
  await flushPromises()
  const option = [...document.body.querySelectorAll<HTMLElement>('.v-list-item')].find((el) =>
    el.textContent?.includes(text),
  )
  expect(option, text).toBeDefined()
  option!.click()
  await flushPromises()
}

describe('výber detských receptov v rozbaľovacom poli', () => {
  it('predvolene sú detské skryté; „Aj detské“ pošle kids=1 a „Len detské“ kids=only', async () => {
    const { router, wrapper } = await mountPage()
    expect(requested().every((u) => !u.includes('kids='))).toBe(true)
    expect(wrapper.find('[data-test="kids-select"]').text()).toContain('Bez detských')

    await chooseKids(wrapper, 'Aj detské')
    await vi.waitFor(() => expect(router.currentRoute.value.query.detske).toBe('1'))
    await vi.waitFor(() => expect(requested().some((u) => u.includes('kids=1'))).toBe(true))

    await chooseKids(wrapper, 'Len detské')
    await vi.waitFor(() => expect(router.currentRoute.value.query.detske).toBe('len'))
    await vi.waitFor(() => expect(requested().some((u) => u.includes('kids=only'))).toBe(true))

    await chooseKids(wrapper, 'Bez detských')
    await vi.waitFor(() => expect(router.currentRoute.value.query.detske).toBeUndefined())
  })

  it('z adresy sa zvolí príslušná možnosť', async () => {
    const { wrapper } = await mountPage('/recepty?detske=len')
    expect(requested().some((u) => u.includes('kids=only'))).toBe(true)
    expect(wrapper.find('[data-test="kids-select"]').text()).toContain('Len detské')
  })

  it('v angličtine majú možnosti anglické popisy', async () => {
    setLocale('en')
    const { wrapper } = await mountPage()
    expect(wrapper.find('[data-test="kids-select"]').text()).toContain('No baby food')
    await wrapper.find('[data-test="kids-select"] .v-field').trigger('mousedown')
    await flushPromises()
    const titles = [...document.body.querySelectorAll('.v-list-item')].map((el) => el.textContent?.trim())
    expect(titles).toEqual(expect.arrayContaining(['No baby food', 'With baby food', 'Baby food only']))
  })
})

describe('vypnuté detské jedlá v nastaveniach', () => {
  it('prepínač sa nezobrazí a kids sa neposiela, ani keď je v adrese', async () => {
    const { wrapper } = await mountPage('/recepty?detske=1', false)
    expect(wrapper.find('[data-test="kids-select"]').exists()).toBe(false)
    expect(requested().every((u) => !u.includes('kids='))).toBe(true)
  })
})

describe('hlavička zoznamu receptov', () => {
  it('nadpis, hľadanie a filtre sú v pevnej hlavičke, posúva sa len zoznam pod nimi', async () => {
    const { wrapper } = await mountPage()
    const header = wrapper.find('[data-test="list-header"]')
    expect(header.exists()).toBe(true)
    expect(header.find('input').exists()).toBe(true)
    expect(header.find('[data-test="filters-button"]').exists()).toBe(true)
    const body = wrapper.find('[data-test="list-body"]')
    expect(body.classes()).toContain('overflow-y-auto')
    expect(header.element.contains(body.element)).toBe(false)
  })
})
