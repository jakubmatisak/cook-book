import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { RecipeSummaryDto } from '@shared/api'
import type { RecipeCategory } from '@shared/recipes'
import HomePage from '@/features/home/pages/HomePage.vue'
import { routes } from '@/router'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

const recipe = (id: string, category: RecipeCategory, isFavorite = false): RecipeSummaryDto => ({
  id,
  title: `Recept ${id}`,
  slug: id,
  category,
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 20,
  difficulty: 1,
  coverImageUrl: null,
  tags: [],
  isFavorite,
  visibility: 'private',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  lastCookedAt: null,
})
const list = (items: RecipeSummaryDto[]) => ({
  items,
  facets: {
    category: items.reduce<Record<string, number>>(
      (acc, r) => ({ ...acc, [r.category]: (acc[r.category] ?? 0) + 1 }),
      {},
    ),
    tag: {},
    difficulty: {},
    time: {},
    missing: {},
  },
})
const Blank = defineComponent({ render: () => h('div') })

async function mountHome(items: RecipeSummaryDto[], userSettings: Record<string, unknown> = {}) {
  const calls = stubApi({ '/me': { ...me('owner'), userSettings }, '/recipes': list(items) })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomePage },
      { path: '/recepty', component: Blank },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(HomePage)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return { calls, router, wrapper }
}

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const items = [
  recipe('1', 'polievka'),
  recipe('2', 'hlavne', true),
  recipe('3', 'hlavne'),
  recipe('4', 'dezert'),
  recipe('5', 'detske'),
]

describe('úvodná stránka (prehľad)', () => {
  it('je na adrese /', () => {
    expect(routes.find((r) => r.path === '/')?.redirect).toBeUndefined()
    expect(routes.find((r) => r.path === '/')?.name).toBe('home')
  })

  it('ukáže dlaždice kategórií s počtami, len tie, v ktorých sú recepty', async () => {
    const { wrapper } = await mountHome(items)
    const tile = (c: string) => wrapper.find(`[data-test="tile-${c}"]`)
    expect(tile('hlavne').text()).toContain('Hlavné jedlo')
    expect(tile('hlavne').text()).toContain('2 recepty')
    expect(tile('polievka').text()).toContain('1 recept')
    expect(tile('dezert').exists()).toBe(true)
    expect(tile('napoj').exists()).toBe(false)
    expect(tile('salat').exists()).toBe(false)
  })

  it('má aj dlaždice Všetky recepty a Obľúbené (bez detských v počte všetkých)', async () => {
    const { wrapper } = await mountHome(items)
    expect(wrapper.find('[data-test="tile-all"]').text()).toContain('4 recepty')
    expect(wrapper.find('[data-test="tile-favorites"]').text()).toContain('1 recept')
  })

  it('klik na kategóriu otvorí zoznam receptov s filtrom podľa nej', async () => {
    const { router, wrapper } = await mountHome(items)
    await wrapper.find('[data-test="tile-dezert"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/recepty'))
    expect(router.currentRoute.value.query.kategoria).toBe('dezert')
  })

  it('Všetky recepty a Obľúbené vedú na zoznam bez kategórie / s filtrom obľúbených', async () => {
    const first = await mountHome(items)
    await first.wrapper.find('[data-test="tile-all"]').trigger('click')
    await vi.waitFor(() => expect(first.router.currentRoute.value.path).toBe('/recepty'))
    expect(first.router.currentRoute.value.query).toEqual({})
    document.body.innerHTML = ''
    const second = await mountHome(items)
    await second.wrapper.find('[data-test="tile-favorites"]').trigger('click')
    await vi.waitFor(() => expect(second.router.currentRoute.value.query.oblubene).toBe('1'))
  })

  it('detské recepty majú vlastnú dlaždicu a pri vypnutých v nastaveniach zmiznú', async () => {
    const on = await mountHome(items)
    expect(on.wrapper.find('[data-test="tile-detske"]').exists()).toBe(true)
    await on.wrapper.find('[data-test="tile-detske"]').trigger('click')
    await vi.waitFor(() => expect(on.router.currentRoute.value.query.kategoria).toBe('detske'))
    document.body.innerHTML = ''
    const off = await mountHome(items, { kidsEnabled: false })
    expect(off.wrapper.find('[data-test="tile-detske"]').exists()).toBe(false)
  })

  it('bez receptov ponúkne pridanie prvého', async () => {
    const { wrapper } = await mountHome([])
    expect(wrapper.find('[data-test="home-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="tile-all"]').exists()).toBe(false)
  })

  it('v angličtine má popisy po anglicky', async () => {
    setLocale('en')
    const { wrapper } = await mountHome(items)
    expect(wrapper.find('[data-test="tile-hlavne"]').text()).toContain('Main course')
    expect(wrapper.find('[data-test="tile-all"]').text()).toContain('All recipes')
  })
})
