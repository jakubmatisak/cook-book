import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import AppEffects from '@/components/AppEffects.vue'
import RecipesPage from '@/features/recipes/pages/RecipesPage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

// Stránka receptov sa v plnej sade testov vykresľuje pomalšie.
vi.setConfig({ testTimeout: 20_000 })

const emptyList = { items: [], facets: { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} } }
const Blank = defineComponent({ render: () => h('div') })

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
}

async function mountPage(width: number, url = '/recipes') {
  setViewport(width)
  stubApi({ '/me': me('owner'), '/recipes': emptyList, '/tags': [] })
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
  return { router, wrapper }
}

const inPage = (wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'], selector: string) =>
  wrapper.find(selector).exists()
const inBody = (selector: string) => document.body.querySelector(selector) !== null

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('filtre receptov na mobile', () => {
  it('na stránke ostane hľadanie a tlačidlo Filtre, ostatné ovládanie je v paneli', async () => {
    const { wrapper } = await mountPage(390)
    expect(inPage(wrapper, '[data-test="filters-button"]')).toBe(true)
    for (const selector of [
      '[data-test="favorite-toggle"]',
      '[data-test="kids-select"]',
      '[data-test="public-select"]',
      '[data-test="pantry-toggle"]',
      '[data-test="sort-select"]',
      '[data-test="verified-toggle"]',
    ]) {
      expect(inBody(selector), selector).toBe(false)
    }

    await wrapper.find('[data-test="filters-button"]').trigger('click')
    await flushPromises()
    for (const selector of [
      '[data-test="favorite-toggle"]',
      '[data-test="kids-select"]',
      '[data-test="public-select"]',
      '[data-test="pantry-toggle"]',
      '[data-test="sort-select"]',
      '[data-test="verified-toggle"]',
    ]) {
      expect(inBody(selector), selector).toBe(true)
    }
  })

  it('akcie v hlavičke sú na mobile len ikonky s popisom pre čítačky', async () => {
    const { wrapper } = await mountPage(390)
    const importButton = wrapper.find('[data-test="import-button"]')
    expect(importButton.text()).toBe('')
    expect(importButton.attributes('aria-label')).toBe('Importovať z webu')
  })

  it('Obľúbené v paneli zapnú rovnaký filter ako na počítači', async () => {
    const { router, wrapper } = await mountPage(390)
    await wrapper.find('[data-test="filters-button"]').trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-test="favorite-toggle"]')!.click()
    await vi.waitFor(() => expect(router.currentRoute.value.query.favorites).toBe('1'))
  })

  it('vysvetlenie pri „Čo viem uvariť“ je na mobile skryté, na počítači ostáva', async () => {
    const mobile = await mountPage(390, '/recipes?pantry=1')
    expect(inPage(mobile.wrapper, '[data-test="pantry-hint"]')).toBe(false)
    mobile.wrapper.unmount()
    document.body.innerHTML = ''
    const desktop = await mountPage(1280, '/recipes?pantry=1')
    expect(inPage(desktop.wrapper, '[data-test="pantry-hint"]')).toBe(true)
  })

  it('na počítači ostáva ovládanie na stránke', async () => {
    const { wrapper } = await mountPage(1280)
    expect(inPage(wrapper, '[data-test="favorite-toggle"]')).toBe(true)
    expect(inPage(wrapper, '[data-test="sort-select"]')).toBe(true)
  })
})

describe('filtre receptov na počítači v jednom riadku', () => {
  it('Detské recepty a Recepty od iných sú v paneli Filtre, nie v riadku', async () => {
    const { wrapper } = await mountPage(1280)
    const header = wrapper.find('[data-test="list-header"]')
    expect(header.find('[data-test="kids-select"]').exists()).toBe(false)
    expect(header.find('[data-test="public-select"]').exists()).toBe(false)
    await wrapper.find('[data-test="filters-button"]').trigger('click')
    await flushPromises()
    const panel = document.body.querySelector('[data-test="filter-quick"]')!
    expect(panel.querySelector('[data-test="kids-select"]')).not.toBeNull()
    expect(panel.querySelector('[data-test="public-select"]')).not.toBeNull()
    // Ostatné rýchle filtre ostávajú v riadku, v paneli nie sú dvakrát.
    expect(document.body.querySelectorAll('[data-test="favorite-toggle"]')).toHaveLength(1)
  })

  it('zapnuté detské a cudzie recepty sa zarátajú do Filtre (n) a ukážu sa ako čipy, ktoré sa dajú zrušiť', async () => {
    const { router, wrapper } = await mountPage(1280, '/recipes?kids=include&public=only')
    expect(wrapper.find('[data-test="filters-button"]').text()).toContain('(2)')
    const chips = wrapper.find('[data-test="active-filters"]').text()
    expect(chips).toContain('Aj detské')
    expect(chips).toContain('Len cudzie')
    const kidsChip = wrapper
      .findAll('[data-test="active-filters"] .v-chip')
      .find((c) => c.text().includes('Aj detské'))!
    await kidsChip.find('.v-chip__close').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.kids).toBeUndefined())
    expect(router.currentRoute.value.query.public).toBe('only')
  })
})

describe('výška ovládania v riadku filtrov na počítači', () => {
  it('výbery majú hustotu podľa nastavenia a tlačidlá výšku poľa', async () => {
    setViewport(1280)
    stubApi({ '/me': me('owner'), '/recipes': emptyList, '/tags': [] })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/recipes', component: Blank }],
    })
    await router.push('/recipes')
    await router.isReady()
    const wrapper = mount(
      { render: () => h(VApp, null, () => h(AppEffects, null, () => h(RecipesPage))) },
      { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
    )
    await flushPromises()
    expect(wrapper.find('[data-test="sort-select"]').classes()).toContain('v-input--density-comfortable')
    const favorite = wrapper.find('[data-test="favorite-toggle"]').element as HTMLElement
    expect(favorite.style.height).toBe('48px')
    // Tlačidlá prepínača zobrazenia majú tiež výšku poľa.
    const view = wrapper.find('[data-test="view-toggle"] .v-btn').element as HTMLElement
    expect(view.style.height).toBe('48px')
    const group = wrapper.find('[data-test="view-toggle"]').element as HTMLElement
    expect(group.style.height).toBe('48px')
  })
})

describe('ukotvená hlavička na mobile', () => {
  it('nadpis, hľadanie a Filtre ostávajú hore, posúva sa len zoznam', async () => {
    const { wrapper } = await mountPage(390)
    const header = wrapper.find('[data-test="list-header"]')
    const body = wrapper.find('[data-test="list-body"]')
    expect(header.find('[data-test="filters-button"]').exists()).toBe(true)
    expect(body.classes()).toContain('overflow-y-auto')
    expect(body.element.contains(header.element)).toBe(false)
  })
})

describe('nadpis stránky', () => {
  it('je na mobile menší ako na počítači', async () => {
    const mobile = await mountPage(390)
    expect(mobile.wrapper.find('[data-test="page-title"]').classes()).toContain('text-title-large')
    mobile.wrapper.unmount()
    document.body.innerHTML = ''
    const desktop = await mountPage(1280)
    expect(desktop.wrapper.find('[data-test="page-title"]').classes()).toContain('text-headline-large')
  })
})
