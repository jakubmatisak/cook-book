import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { VApp } from 'vuetify/components'
import type { IngredientDto } from '@shared/api'
import IngredientsPage from '@/features/ingredients/pages/IngredientsPage.vue'
import { setLocale } from '@/i18n'
import { jsonResponse, me, mountPlugins, stubApi, type StubCall } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const ing = (id: string, name: string, shopCategoryId: string | null = null): IngredientDto => ({
  id,
  name,
  defaultUnit: null,
  shopCategoryId,
  usageCount: 1,
})

async function mountPage() {
  const calls = stubApi({
    '/me': me('owner'),
    '/ingredients': [
      ing('h', 'Plnotučná horčica'),
      ing('m', 'Marhule nakladané'),
      ing('x', 'Mochnáče'),
      ing('z', 'Mrkva', 'veg'),
    ],
    '/ingredients/starter': { total: 100, missing: 0 },
    '/ingredients/merge-ignored': [],
    '/shop-categories': [
      { id: 'veg', name: 'Zelenina', sortOrder: 0 },
      { id: 'kon', name: 'Konzervy a zaváraniny', sortOrder: 1 },
      { id: 'kor', name: 'Koreniny a dochucovadlá', sortOrder: 2 },
    ],
    'POST /ingredients/bulk/update': (call: StubCall) =>
      jsonResponse({ affected: (call.body as { ids: string[] }).ids.length }),
  })
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(IngredientsPage)) },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  return { calls, wrapper }
}

describe('návrh kategórií pre nezaradené ingrediencie', () => {
  it('ponúkne návrhy len pre tie, pri ktorých si je istý, a zaradí vybrané', async () => {
    const { wrapper, calls } = await mountPage()
    const button = wrapper.find('[data-test="suggest-categories"]')
    expect(button.text()).toContain('Navrhnúť kategórie (2)')
    await button.trigger('click')
    await flushPromises()
    const rows = [...document.querySelectorAll('[data-test="category-suggestion"]')].map((r) => r.textContent)
    expect(rows).toHaveLength(2)
    expect(rows.join(' ')).toContain('Plnotučná horčica')
    expect(rows.join(' ')).toContain('Marhule nakladané')
    expect(rows.join(' ')).not.toContain('Mochnáče')

    // Odznačí marhule, zaradí len horčicu.
    document.querySelector<HTMLElement>('[data-test="category-suggestion-m"] input')!.click()
    await flushPromises()
    document.querySelector<HTMLElement>('[data-test="category-suggest-apply"]')!.click()
    await flushPromises()
    const updates = calls.filter((c) => c.method === 'POST' && c.path === '/ingredients/bulk/update')
    expect(updates.map((c) => c.body)).toEqual([{ ids: ['h'], shopCategoryId: 'kor' }])
  })
})
