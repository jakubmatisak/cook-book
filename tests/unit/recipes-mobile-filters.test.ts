import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
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
      '[data-test="view-toggle"]',
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
      '[data-test="view-toggle"]',
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
