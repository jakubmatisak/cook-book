import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { RecipeSummaryDto } from '@shared/api'
import { parseListQuery, savableListQuery } from '@/features/recipes/listQuery'
import RecipesPage from '@/features/recipes/pages/RecipesPage.vue'
import { PRIMARY_NAV, SECONDARY_NAV } from '@/components/navigation'
import { routes } from '@/router'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

// Výber v rozbaľovacom poli je pri plnom behu testov pomalší, preto dlhší limit.
vi.setConfig({ testTimeout: 20_000 })

// jsdom nemá IndexedDB, ktorý používa fronta odškrtnutí bez signálu.
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }))

const recipe = (id: string, title: string, over: Partial<RecipeSummaryDto> = {}): RecipeSummaryDto => ({
  id,
  title,
  slug: id,
  category: 'hlavne',
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 20,
  difficulty: 1,
  coverImageUrl: null,
  tags: [],
  isFavorite: false,
  visibility: 'private',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  lastCookedAt: null,
  ...over,
})
const facets = { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} }
const items = [
  recipe('r1', 'Môj guláš'),
  recipe('r2', 'Môj verejný koláč', { visibility: 'public' }),
  recipe('f1', 'Cudzia kaša', { visibility: 'public', householdName: 'Rodičia' }),
]
const Blank = defineComponent({ render: () => h('div') })

async function mountPage(url = '/recepty', role: 'owner' | 'member' = 'owner') {
  const calls = stubApi({ '/me': me(role), '/recipes': { items, facets }, '/tags': [] })
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
  return { calls, router, wrapper }
}
const requested = () =>
  (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    .map((c) => String(c[0]))
    .filter((u) => u.includes('/recipes') && !u.includes('/recipes/'))

async function choose(wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'], text: string) {
  await wrapper.find('[data-test="public-select"] .v-field').trigger('mousedown')
  await flushPromises()
  const option = [...document.body.querySelectorAll<HTMLElement>('.v-list-item')].find((el) =>
    el.textContent?.includes(text),
  )
  expect(option, text).toBeDefined()
  option!.click()
  await flushPromises()
}

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('adresa a uložené filtre', () => {
  it('verejne=1 je „s verejnými“, verejne=len „len verejné“, inak bez', () => {
    expect(parseListQuery({}).public).toBe('hide')
    expect(parseListQuery({ verejne: '1' }).public).toBe('include')
    expect(parseListQuery({ verejne: 'len' }).public).toBe('only')
    expect(parseListQuery({ verejne: 'xx' }).public).toBe('hide')
  })

  it('ukladá sa medzi predvolené filtre', () => {
    expect(savableListQuery({ verejne: '1' })).toEqual({ verejne: '1' })
  })
})

describe('Verejné recepty v zozname receptov', () => {
  it('karta „Verejné recepty“ v menu už nie je, adresa /verejne presmeruje na filter', () => {
    const all = [...PRIMARY_NAV, ...SECONDARY_NAV].map((i) => i.to)
    expect(all).not.toContain('/verejne')
    const route = routes.find((r) => r.path === '/verejne')
    expect(route?.redirect).toEqual({ path: '/recepty', query: { verejne: 'len' } })
    expect(routes.some((r) => r.path === '/verejne/:id')).toBe(true)
  })

  it('filter je predvolene „Bez verejných“ a nič neposiela', async () => {
    const { wrapper } = await mountPage()
    expect(wrapper.find('[data-test="public-select"]').text()).toContain('Bez verejných')
    expect(requested().every((u) => !u.includes('public='))).toBe(true)
  })

  it('výber „S verejnými“ a „Len verejné“ pošle public= a uloží verejne do adresy', async () => {
    const { router, wrapper } = await mountPage()
    await choose(wrapper, 'S verejnými')
    await vi.waitFor(() => expect(router.currentRoute.value.query.verejne).toBe('1'))
    await vi.waitFor(() => expect(requested().some((u) => u.includes('public=include'))).toBe(true))
    await choose(wrapper, 'Len verejné')
    await vi.waitFor(() => expect(router.currentRoute.value.query.verejne).toBe('len'))
    await vi.waitFor(() => expect(requested().some((u) => u.includes('public=only'))).toBe(true))
    await choose(wrapper, 'Bez verejných')
    await vi.waitFor(() => expect(router.currentRoute.value.query.verejne).toBeUndefined())
  })

  it('z adresy verejne=len sa filter zvolí hneď', async () => {
    const { wrapper } = await mountPage('/recepty?verejne=len')
    expect(requested().some((u) => u.includes('public=only'))).toBe(true)
    expect(wrapper.find('[data-test="public-select"]').text()).toContain('Len verejné')
  })

  it('cudzí recept má odznak s domácnosťou a vedie na verejný detail, môj verejný má odznak „Verejný“', async () => {
    const { wrapper } = await mountPage('/recepty?verejne=1')
    const foreign = wrapper.find('[data-test="recipe-card-f1"]')
    expect(foreign.text()).toContain('Verejný · Rodičia')
    expect(foreign.attributes('href')).toBe('/verejne/f1')
    const own = wrapper.find('[data-test="recipe-card-r2"]')
    expect(own.text()).toContain('Verejný')
    expect(own.text()).not.toContain('Rodičia')
    expect(own.attributes('href')).toBe('/recepty/r2')
    expect(wrapper.find('[data-test="recipe-card-r1"]').text()).not.toContain('Verejný')
  })

  it('cudzí recept nemá tlačidlo obľúbených a nedá sa vybrať pre hromadné úpravy', async () => {
    const { wrapper } = await mountPage('/recepty?verejne=1')
    await wrapper.find('[data-test="select-mode"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="select-r1"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="select-f1"]').exists()).toBe(false)
    await wrapper.find('[data-test="bulk-select-all"]').trigger('click')
    expect(wrapper.find('[data-test="bulk-count"]').text()).toBe('Vybrané: 2')
  })

  it('v angličtine sú možnosti po anglicky', async () => {
    setLocale('en')
    const { wrapper } = await mountPage()
    expect(wrapper.find('[data-test="public-select"]').text()).toContain('Without public')
  })
})
