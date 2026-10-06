import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ShoppingItemDto } from '@shared/api'
import ShoppingPage from '@/features/shopping/pages/ShoppingPage.vue'
import ShoppingPrintList from '@/features/shopping/components/ShoppingPrintList.vue'
import { setLocale } from '@/i18n'
import { createAppVuetify } from '@/plugins/vuetify'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

// jsdom nemá IndexedDB, ktorý používa fronta odškrtnutí bez signálu.
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }))

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const item = (over: Partial<ShoppingItemDto> & { id: string; name: string }): ShoppingItemDto => ({
  listId: 'l1',
  ingredientId: null,
  quantity: null,
  unit: null,
  shopCategoryId: null,
  isChecked: false,
  checkedAt: null,
  source: 'generated',
  sources: [{ date: '2026-10-06', recipeTitle: 'Hovädzí guláš', coverImageUrl: '/img/default/x.webp' }],
  updatedAt: '2026-10-05T10:00:00Z',
  ...over,
})

const groups = [
  {
    id: 'zel',
    name: 'Zelenina',
    items: [
      item({ id: 'i1', name: 'Mrkva', quantity: 1.5, unit: 'kg' }),
      item({ id: 'i2', name: 'Cibuľa', quantity: 3, unit: 'ks' }),
    ],
  },
  { id: 'none', name: 'Iné', items: [item({ id: 'i3', name: 'Soľ' })] },
]

describe('tlačový pohľad nákupu', () => {
  const mountList = () =>
    mount(ShoppingPrintList, {
      props: { groups, date: '2026-10-06' },
      global: { plugins: [createAppVuetify()] },
    })

  it('je viditeľný len pri tlači a má viac stĺpcov', () => {
    const root = mountList().find('[data-test="print-list"]')
    expect(root.classes()).toEqual(expect.arrayContaining(['d-none', 'd-print-block']))
    expect(root.find('[data-test="print-columns"]').attributes('style')).toContain('column-count: 3')
  })

  it('zhustene vypíše kategórie, položky a množstvá s prázdnym štvorčekom', () => {
    const text = mountList().text()
    expect(text).toContain('Zelenina')
    expect(text).toContain('Mrkva')
    expect(text).toContain('1,5 kg')
    expect(text).toContain('3 ks')
    expect(text).toContain('Soľ')
    expect(mountList().findAll('[data-test="print-item"]')).toHaveLength(3)
  })

  it('bez fotiek a bez pôvodu položky (recept, deň)', () => {
    const wrapper = mountList()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.v-img').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Hovädzí guláš')
  })

  it('nadpis s dátumom je v jazyku aplikácie', () => {
    expect(mountList().text()).toContain('Vytlačené 6. 10. 2026')
    setLocale('en')
    expect(mountList().text()).toContain('Printed 10/6/2026')
  })
})

describe('stránka Nákup pri tlači', () => {
  it('interaktívny zoznam sa pri tlači skryje a vytlačí sa len zhustený pohľad', async () => {
    stubApi({
      '/me': me('owner'),
      '/shopping/lists': [{ id: 'l1', name: 'Nákup', isDefault: true }],
      '/shopping/lists/l1/items': [
        item({ id: 'i1', name: 'Mrkva' }),
        item({ id: 'i2', name: 'Chlieb', isChecked: true }),
      ],
      '/shop-categories': [],
    })
    const wrapper = mount(ShoppingPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
    await flushPromises()
    expect(wrapper.find('[data-test="interactive-list"]').classes()).toContain('d-print-none')
    const printed = wrapper.find('[data-test="print-list"]')
    expect(printed.exists()).toBe(true)
    // vytlačí sa len to, čo ešte treba kúpiť
    expect(printed.text()).toContain('Mrkva')
    expect(printed.text()).not.toContain('Chlieb')
  })
})
