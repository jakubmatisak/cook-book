import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { VApp } from 'vuetify/components'
import type { IngredientDto } from '@shared/api'
import PantryPage from '@/features/pantry/pages/PantryPage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

vi.setConfig({ testTimeout: 20_000 })

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
}

const ing = (id: string, name: string, shopCategoryId: string | null): IngredientDto => ({
  id,
  name,
  defaultUnit: null,
  shopCategoryId,
  usageCount: 0,
})

async function mountPantry(width: number) {
  setViewport(width)
  stubApi({
    '/me': me('owner'),
    '/ingredients': [ing('i1', 'Mrkva', 'c1'), ing('i2', 'Mlieko', 'c2')],
    '/shop-categories': [
      { id: 'c1', name: 'Zelenina', sortOrder: 1 },
      { id: 'c2', name: 'Mliečne', sortOrder: 2 },
    ],
    '/pantry': { ingredientIds: [], items: [] },
    '/staples': [],
  })
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(PantryPage)) },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  return wrapper
}

const inBody = (selector: string) => document.body.querySelector(selector) !== null

describe('filtre špajze na mobile', () => {
  it('nad zoznamom je len hľadanie a tlačidlo Filtre; kategória a prepínače sú v spodnom paneli', async () => {
    const wrapper = await mountPantry(390)
    expect(inBody('[data-test="pantry-category"]')).toBe(false)
    expect(inBody('[data-test="expiring-chip"]')).toBe(false)
    expect(wrapper.find('[data-test="pantry-intro"]').exists()).toBe(false)

    await wrapper.find('[data-test="pantry-filters-button"]').trigger('click')
    await flushPromises()
    expect(inBody('[data-test="pantry-category"]')).toBe(true)
    expect(inBody('[data-test="only-home-chip"]')).toBe(true)
    expect(inBody('[data-test="expiring-chip"]')).toBe(true)
  })

  it('prepínač v paneli filtruje zoznam a počet sa ukáže na tlačidle', async () => {
    const wrapper = await mountPantry(390)
    await wrapper.find('[data-test="pantry-filters-button"]').trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-test="only-home-chip"]')!.click()
    await flushPromises()
    expect(wrapper.text()).not.toContain('Mrkva')
    const badge = wrapper.find('[data-test="pantry-filters-button"]').element.closest('.v-badge')
    expect(badge?.querySelector('.v-badge__badge')?.textContent).toContain('1')
  })

  it('na počítači ostávajú filtre na stránke', async () => {
    const wrapper = await mountPantry(1280)
    expect(wrapper.find('[data-test="pantry-category"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="pantry-filters-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="pantry-intro"]').exists()).toBe(true)
  })
})

describe('výška ovládania v riadku s poliami', () => {
  it('prepínače majú rovnakú výšku ako pole podľa hustoty rozhrania', async () => {
    for (const [density, height] of [
      ['compact', '40px'],
      ['comfortable', '48px'],
      ['default', '56px'],
    ] as const) {
      setViewport(1280)
      stubApi({
        '/me': { ...me('owner'), userSettings: { density } },
        '/ingredients': [ing('i1', 'Mrkva', 'c1')],
        '/shop-categories': [{ id: 'c1', name: 'Zelenina', sortOrder: 1 }],
        '/pantry': { ingredientIds: [], items: [] },
        '/staples': [],
      })
      const wrapper = mount(
        { render: () => h(VApp, null, () => h(PantryPage)) },
        { global: { plugins: mountPlugins() }, attachTo: document.body },
      )
      await flushPromises()
      const button = wrapper.find('[data-test="only-home-chip"]').element as HTMLElement
      expect(button.style.height, density).toBe(height)
      wrapper.unmount()
      document.body.innerHTML = ''
    }
  })
})
