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

async function mountPage(url = '/recipes', role: 'owner' | 'member' = 'owner', showOthersRecipes = false) {
  const base = me(role)
  const calls = stubApi({
    '/me': { ...base, userSettings: showOthersRecipes ? { showOthersRecipes } : {} },
    '/recipes': { items, facets },
    '/tags': [],
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/recipes', component: Blank }],
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
  it('public=include je „moje aj cudzie“, public=only „len cudzie“, inak len moje', () => {
    expect(parseListQuery({}).public).toBe('hide')
    expect(parseListQuery({ public: 'include' }).public).toBe('include')
    expect(parseListQuery({ public: 'only' }).public).toBe('only')
    expect(parseListQuery({ public: 'xx' }).public).toBe('hide')
  })

  it('so zapnutým „Zobrazovať recepty od iných“ je predvolené „moje aj cudzie“; public=hide ich skryje', () => {
    expect(parseListQuery({}, 'include').public).toBe('include')
    expect(parseListQuery({ public: 'hide' }, 'include').public).toBe('hide')
    expect(parseListQuery({ public: 'only' }, 'include').public).toBe('only')
  })

  it('ukladá sa medzi predvolené filtre', () => {
    expect(savableListQuery({ public: 'include' })).toEqual({ public: 'include' })
  })
})

describe('Verejné recepty v zozname receptov', () => {
  it('karta „Verejné recepty“ v menu už nie je, adresa /public presmeruje na filter', () => {
    const all = [...PRIMARY_NAV, ...SECONDARY_NAV].map((i) => i.to)
    expect(all).not.toContain('/public')
    const route = routes.find((r) => r.path === '/public')
    expect(route?.redirect).toEqual({ path: '/recipes', query: { public: 'only' } })
    expect(routes.some((r) => r.path === '/public/:id')).toBe(true)
  })

  it('filter je predvolene „Len moje“ a serveru ho pošle výslovne', async () => {
    const { wrapper } = await mountPage()
    expect(wrapper.find('[data-test="public-select"]').text()).toContain('Len moje')
    // Výslovne: server sa nespolieha na svoje nastavenie (karta či iné zariadenie ho môže mať inak).
    expect(requested().length).toBeGreaterThan(0)
    expect(requested().every((u) => u.includes('public=hide'))).toBe(true)
  })

  it('výber „Moje aj cudzie“ a „Len cudzie“ pošle public= a uloží public do adresy', async () => {
    const { router, wrapper } = await mountPage()
    await choose(wrapper, 'Moje aj cudzie')
    await vi.waitFor(() => expect(router.currentRoute.value.query.public).toBe('include'))
    await vi.waitFor(() => expect(requested().some((u) => u.includes('public=include'))).toBe(true))
    await choose(wrapper, 'Len cudzie')
    await vi.waitFor(() => expect(router.currentRoute.value.query.public).toBe('only'))
    await vi.waitFor(() => expect(requested().some((u) => u.includes('public=only'))).toBe(true))
    await choose(wrapper, 'Len moje')
    await vi.waitFor(() => expect(router.currentRoute.value.query.public).toBeUndefined())
  })

  it('so zapnutým nastavením je filter predvolene „Moje aj cudzie“; „Len moje“ pošle a uloží public=hide', async () => {
    const { router, wrapper } = await mountPage('/recipes', 'owner', true)
    expect(wrapper.find('[data-test="public-select"]').text()).toContain('Moje aj cudzie')
    // Aj predvolený výber sa posiela výslovne – zoznam nesmie závisieť od nastavenia na serveri.
    expect(requested().every((u) => u.includes('public=include'))).toBe(true)
    expect(wrapper.find('[data-test="active-filters"]').exists()).toBe(false)

    await choose(wrapper, 'Len moje')
    await vi.waitFor(() => expect(router.currentRoute.value.query.public).toBe('hide'))
    await vi.waitFor(() => expect(requested().some((u) => u.includes('public=hide'))).toBe(true))
    await choose(wrapper, 'Moje aj cudzie')
    await vi.waitFor(() => expect(router.currentRoute.value.query.public).toBeUndefined())
  })

  it('z adresy public=only sa filter zvolí hneď', async () => {
    const { wrapper } = await mountPage('/recipes?public=only')
    expect(requested().some((u) => u.includes('public=only'))).toBe(true)
    expect(wrapper.find('[data-test="public-select"]').text()).toContain('Len cudzie')
  })

  it('cudzí recept má odznak „Od: domácnosť“ a vedie na verejný detail, môj zdieľaný má odznak „Zdieľaný“', async () => {
    const { wrapper } = await mountPage('/recipes?public=include')
    const foreign = wrapper.find('[data-test="recipe-card-f1"]')
    expect(foreign.text()).toContain('Od: Rodičia')
    expect(foreign.attributes('href')).toBe('/public/f1')
    const own = wrapper.find('[data-test="recipe-card-r2"]')
    expect(own.text()).toContain('Zdieľaný')
    expect(own.text()).not.toContain('Rodičia')
    expect(own.attributes('href')).toBe('/recipes/r2')
    expect(wrapper.find('[data-test="recipe-card-r1"]').text()).not.toContain('Zdieľaný')
  })

  it('cudzí recept nemá tlačidlo obľúbených a nedá sa vybrať pre hromadné úpravy', async () => {
    const { wrapper } = await mountPage('/recipes?public=include')
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
    expect(wrapper.find('[data-test="public-select"]').text()).toContain('Mine only')
  })
})
