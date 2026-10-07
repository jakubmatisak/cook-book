import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ShoppingItemDto } from '@shared/api'
import type { UserSettingsDto } from '@shared/userSettings'
import ShoppingPage from '@/features/shopping/pages/ShoppingPage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }))

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const item = (id: string, name: string, isChecked = false): ShoppingItemDto => ({
  id,
  name,
  listId: 'l1',
  ingredientId: null,
  quantity: null,
  unit: null,
  shopCategoryId: null,
  isChecked,
  checkedAt: null,
  source: 'manual',
  sources: [],
  updatedAt: '2026-10-05T10:00:00Z',
})

async function mountPage(userSettings: UserSettingsDto = {}) {
  const calls = stubApi({
    '/me': { ...me('owner'), userSettings },
    '/shopping/lists': [{ id: 'l1', name: 'Nákup', isDefault: true }],
    '/shopping/lists/l1/items': [item('i1', 'Mrkva'), item('i2', 'Chlieb', true)],
    '/shop-categories': [],
    'PUT /me/settings': { shoppingCartOpen: false },
  })
  const wrapper = mount(ShoppingPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
  await flushPromises()
  return { calls, wrapper }
}

describe('sekcia „V košíku“', () => {
  it('je predvolene rozbalená, aby bolo vidieť, čo už je v košíku', async () => {
    const { wrapper } = await mountPage()
    expect(wrapper.find('[data-test="cart-list"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Chlieb')
  })

  it('zbalenie sa uloží do nastavení človeka', async () => {
    const { calls, wrapper } = await mountPage()
    await wrapper.find('[data-test="cart-toggle"]').trigger('click')
    await flushPromises()
    const put = calls.find((c) => c.method === 'PUT' && c.path === '/me/settings')
    expect(put?.body).toEqual({ shoppingCartOpen: false })
    expect(wrapper.find('[data-test="cart-list"]').exists()).toBe(false)
  })

  it('uložené zbalenie platí aj po návrate na stránku', async () => {
    const { wrapper } = await mountPage({ shoppingCartOpen: false })
    expect(wrapper.find('[data-test="cart-list"]').exists()).toBe(false)
  })
})
