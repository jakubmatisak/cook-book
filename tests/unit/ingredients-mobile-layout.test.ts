import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { VApp } from 'vuetify/components'
import type { IngredientDto } from '@shared/api'
import IngredientsPage from '@/features/ingredients/pages/IngredientsPage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const ing = (id: string, name: string): IngredientDto => ({
  id,
  name,
  defaultUnit: null,
  shopCategoryId: null,
  usageCount: 1,
})

async function mountAt(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  stubApi({
    '/me': me('owner'),
    '/ingredients': [ing('a', 'Banán'), ing('b', 'Banány'), ing('h', 'Plnotučná horčica')],
    '/ingredients/starter': { total: 100, missing: 3 },
    '/ingredients/merge-ignored': [],
    '/ingredients/units': {},
    '/shop-categories': [{ id: 'k', name: 'Koreniny a dochucovadlá', sortOrder: 0 }],
  })
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(IngredientsPage)) },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  await wrapper.find('[data-test="merge-suggestions"] .v-expansion-panel-title').trigger('click')
  await flushPromises()
  return wrapper
}

describe('Ingrediencie na mobile', () => {
  it('pod 600 px sú akcie hlavičky na celú šírku a akcie návrhu pod textom', async () => {
    const wrapper = await mountAt(390)
    for (const test of ['add-starter', 'suggest-categories', 'select-mode']) {
      expect(wrapper.find(`[data-test="${test}"]`).classes(), test).toContain('v-btn--block')
    }
    const row = wrapper.find('[data-test="merge-suggestion"]')
    expect(row.find('[data-test="suggestion-actions-below"]').exists()).toBe(true)
  })

  it('na počítači ostanú akcie vedľa', async () => {
    const wrapper = await mountAt(1440)
    expect(wrapper.find('[data-test="add-starter"]').classes()).not.toContain('v-btn--block')
    expect(wrapper.find('[data-test="suggestion-actions-below"]').exists()).toBe(false)
  })
})
