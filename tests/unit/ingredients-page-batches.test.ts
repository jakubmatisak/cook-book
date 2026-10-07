import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { VApp } from 'vuetify/components'
import type { IngredientDto } from '@shared/api'
import IngredientsPage from '@/features/ingredients/pages/IngredientsPage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

vi.setConfig({ testTimeout: 20_000 })

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const ingredient = (n: number): IngredientDto => ({
  id: `i${n}`,
  name: `Surovina ${String(n).padStart(3, '0')}`,
  defaultUnit: null,
  shopCategoryId: null,
  usageCount: 0,
})

async function mountPage(count: number) {
  stubApi({
    '/me': me('owner'),
    '/ingredients': Array.from({ length: count }, (_, i) => ingredient(i + 1)),
    '/ingredients/starter': { total: 100, missing: 0 },
    '/shop-categories': [],
  })
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(IngredientsPage)) },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  return wrapper
}

const rows = (wrapper: Awaited<ReturnType<typeof mountPage>>) =>
  wrapper.findAll('[data-test="ingredient-row"]')

describe('dlhý zoznam ingrediencií', () => {
  it('vykreslí najprv len prvú dávku, ďalšie riadky až pri posúvaní (stránka sa nesekne)', async () => {
    const wrapper = await mountPage(300)
    expect(rows(wrapper).length).toBe(30)
    await wrapper.find('[data-test="ingredients-more"]').trigger('click')
    expect(rows(wrapper).length).toBe(60)
  })

  it('hľadanie hľadá vo všetkých, nielen vo vykreslených', async () => {
    const wrapper = await mountPage(300)
    await wrapper.find('input').setValue('Surovina 250')
    expect(rows(wrapper).map((r) => r.text())).toEqual([expect.stringContaining('Surovina 250')])
    expect(wrapper.find('[data-test="ingredients-more"]').exists()).toBe(false)
  })

  it('krátky zoznam sa ukáže celý bez tlačidla ďalšie', async () => {
    const wrapper = await mountPage(20)
    expect(rows(wrapper).length).toBe(20)
    expect(wrapper.find('[data-test="ingredients-more"]').exists()).toBe(false)
  })
})
