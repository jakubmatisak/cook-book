import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ShoppingItemDto } from '@shared/api'
import ShoppingPage from '@/features/shopping/pages/ShoppingPage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

// jsdom nemá IndexedDB, ktorý používa fronta odškrtnutí bez signálu.
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

async function mountPage() {
  const calls = stubApi({
    '/me': me('owner'),
    '/shopping/lists': [{ id: 'l1', name: 'Nákup', isDefault: true }],
    '/shopping/lists/l1/items': [item('i1', 'Mrkva'), item('i2', 'Chlieb', true)],
    '/shop-categories': [],
    'DELETE /shopping/items/i1': () => new Response(null, { status: 204 }),
  })
  const wrapper = mount(ShoppingPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
  await flushPromises()
  return { calls, wrapper }
}

const openMenu = async (wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'], id: string) => {
  await wrapper.find(`[data-test="item-menu-${id}"]`).trigger('click')
  await flushPromises()
}

describe('menu s tromi bodkami pri položke nákupu', () => {
  it('každá položka má tlačidlo menu', async () => {
    const { wrapper } = await mountPage()
    expect(wrapper.find('[data-test="item-menu-i1"]').exists()).toBe(true)
  })

  it('„Odstrániť“ zmaže položku hneď, aj keď nie je kúpená', async () => {
    const { calls, wrapper } = await mountPage()
    await openMenu(wrapper, 'i1')
    const remove = document.body.querySelector<HTMLElement>('[data-test="item-remove"]')
    expect(remove).not.toBeNull()
    remove!.click()
    await flushPromises()
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/shopping/items/i1')).toBe(true)
  })

  it('„Upraviť“ otvorí úpravu položky', async () => {
    const { wrapper } = await mountPage()
    await openMenu(wrapper, 'i1')
    document.body.querySelector<HTMLElement>('[data-test="item-edit"]')!.click()
    await flushPromises()
    expect(document.body.textContent).toContain('Mrkva')
    expect(document.body.querySelector('[data-test="item-edit-dialog"], .v-dialog')).not.toBeNull()
  })
})
