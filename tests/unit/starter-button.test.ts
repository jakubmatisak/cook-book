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

const ingredient = (id: string, name: string): IngredientDto => ({
  id,
  name,
  defaultUnit: null,
  shopCategoryId: null,
  usageCount: 0,
})

async function mountPage(missing: number) {
  const calls = stubApi({
    '/me': me('owner'),
    '/ingredients': [ingredient('i1', 'Mrkva'), ingredient('i2', 'Soľ')],
    '/ingredients/starter': { total: 100, missing },
    'POST /ingredients/starter': { added: missing, total: 100, items: [] },
    '/shop-categories': [],
  })
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(IngredientsPage)) },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  return { calls, wrapper }
}

describe('tlačidlo „Pridať základné suroviny“', () => {
  it('ak žiadna základná surovina nechýba, tlačidlo sa nezobrazí', async () => {
    const { wrapper } = await mountPage(0)
    expect(wrapper.find('[data-test="add-starter"]').exists()).toBe(false)
  })

  it('ak niektorá chýba, tlačidlo sa zobrazí s ich počtom', async () => {
    const { wrapper } = await mountPage(12)
    const button = wrapper.find('[data-test="add-starter"]')
    expect(button.exists()).toBe(true)
    expect(button.text()).toContain('Pridať základné suroviny (12)')
  })

  it('po pridaní tlačidlo zmizne, keď už nič nechýba', async () => {
    const { calls, wrapper } = await mountPage(12)
    // po pridaní server povie, že nechýba nič
    const stub = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    const original = stub.getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>
    stub.mockImplementation((url: string, init?: RequestInit) =>
      String(url).includes('/ingredients/starter') &&
      (init?.method ?? 'GET') === 'GET' &&
      calls.some((c) => c.method === 'POST' && c.path === '/ingredients/starter')
        ? Promise.resolve(
            new Response(JSON.stringify({ total: 100, missing: 0 }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          )
        : original(url, init),
    )
    await wrapper.find('[data-test="add-starter"]').trigger('click')
    await flushPromises()
    expect(calls.some((c) => c.method === 'POST' && c.path === '/ingredients/starter')).toBe(true)
    await vi.waitFor(() => expect(wrapper.find('[data-test="add-starter"]').exists()).toBe(false))
  })

  it('v angličtine má popis po anglicky', async () => {
    setLocale('en')
    const { wrapper } = await mountPage(5)
    expect(wrapper.find('[data-test="add-starter"]').text()).toContain('Add basic ingredients (5)')
  })
})
