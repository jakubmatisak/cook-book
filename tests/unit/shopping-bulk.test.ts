import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ShoppingItemDto } from '@shared/api'
import ShoppingPage from '@/features/shopping/pages/ShoppingPage.vue'
import { jsonResponse, me, mountPlugins, stubApi } from './helpers/apiStub'

// jsdom nemá IndexedDB, ktorý používa fronta odškrtnutí bez signálu.
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }))

afterEach(() => {
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
    '/shopping/lists/l1/items': [item('i1', 'Mrkva'), item('i2', 'Chlieb', true), item('i3', 'Syr')],
    '/shop-categories': [],
    'POST /shopping/lists/l1/check': () => jsonResponse({ changed: 2 }),
    'POST /shopping/lists/l1/clear-all': () => jsonResponse({ removed: 3 }),
  })
  const wrapper = mount(ShoppingPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
  await flushPromises()
  return { calls, wrapper }
}

async function menuAction(wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'], test: string) {
  await wrapper.find('[aria-label="Ďalšie akcie"]').trigger('click')
  await flushPromises()
  const el = document.body.querySelector<HTMLElement>(`[data-test="${test}"]`)
  if (!el) throw new Error(`Chýba ${test}`)
  el.click()
  await flushPromises()
}

const checks = (calls: Awaited<ReturnType<typeof mountPage>>['calls']) =>
  calls.filter((c) => c.method === 'POST' && c.path === '/shopping/lists/l1/check').map((c) => c.body)

describe('hromadné akcie v nákupe', () => {
  it('„Označiť všetko ako kúpené“ dá všetko do košíka naraz a dá sa vrátiť', async () => {
    const { calls, wrapper } = await mountPage()
    await menuAction(wrapper, 'check-all')
    expect(checks(calls)).toEqual([{ isChecked: true, ids: ['i1', 'i3'] }])
    expect(wrapper.text()).toContain('Všetko je v košíku.')
    expect(document.body.textContent).toContain('Označené ako kúpené: 2 položky.')

    const undo = [...document.body.querySelectorAll<HTMLElement>('.v-snackbar button')].find((b) =>
      b.textContent?.includes('Späť'),
    )!
    undo.click()
    await flushPromises()
    expect(checks(calls)[1]).toEqual({ isChecked: false, ids: ['i1', 'i3'] })
  })

  it('„Zrušiť označenie všetkého“ vráti košík medzi položky na kúpenie', async () => {
    const { calls, wrapper } = await mountPage()
    await menuAction(wrapper, 'uncheck-all')
    expect(checks(calls)).toEqual([{ isChecked: false, ids: ['i2'] }])
  })

  it('„Vymazať celý zoznam“ sa najprv opýta, potom zmaže všetko', async () => {
    const { calls, wrapper } = await mountPage()
    await menuAction(wrapper, 'clear-all')
    expect(calls.some((c) => c.path === '/shopping/lists/l1/clear-all')).toBe(false)
    expect(document.body.querySelector('[data-test="clear-all-dialog"]')!.textContent).toContain('3 položky')
    document.body.querySelector<HTMLElement>('[data-test="clear-all-confirm"]')!.click()
    await flushPromises()
    expect(calls.some((c) => c.method === 'POST' && c.path === '/shopping/lists/l1/clear-all')).toBe(true)
    expect(document.body.textContent).toContain('Zoznam je vymazaný (3 položky).')
  })
})
