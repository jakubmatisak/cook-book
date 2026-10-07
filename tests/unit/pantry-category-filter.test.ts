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

const ing = (id: string, name: string, shopCategoryId: string | null): IngredientDto => ({
  id,
  name,
  defaultUnit: null,
  shopCategoryId,
  usageCount: 0,
})

async function mountPantry() {
  stubApi({
    '/me': me('owner'),
    '/ingredients': [
      ing('i1', 'Mrkva', 'c1'),
      ing('i2', 'Cibuľa', 'c1'),
      ing('i3', 'Mlieko', 'c2'),
      ing('i4', 'Soľ', null),
    ],
    '/shop-categories': [
      { id: 'c1', name: 'Zelenina', sortOrder: 1 },
      { id: 'c2', name: 'Mliečne', sortOrder: 2 },
    ],
    '/pantry': { ingredientIds: ['i1'], items: [] },
    '/staples': [],
  })
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(PantryPage)) },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  return wrapper
}

const names = (wrapper: Awaited<ReturnType<typeof mountPantry>>) =>
  wrapper
    .findAll('.v-list-item-title')
    .map((el) => el.text())
    .sort()

async function choose(wrapper: Awaited<ReturnType<typeof mountPantry>>, text: string) {
  await wrapper.find('[data-test="pantry-category"] .v-field').trigger('mousedown')
  await flushPromises()
  const option = [...document.body.querySelectorAll<HTMLElement>('.v-overlay .v-list-item')].find((el) =>
    el.textContent?.includes(text),
  )
  expect(option, text).toBeDefined()
  option!.click()
  await flushPromises()
}

describe('Špajza: filter podľa kategórie', () => {
  it('predvolene ukáže všetky ingrediencie', async () => {
    const wrapper = await mountPantry()
    expect(names(wrapper)).toEqual(['Cibuľa', 'Mlieko', 'Mrkva', 'Soľ'])
  })

  it('výber kategórie ukáže len jej ingrediencie (napr. len zelenina)', async () => {
    const wrapper = await mountPantry()
    await choose(wrapper, 'Zelenina')
    expect(names(wrapper)).toEqual(['Cibuľa', 'Mrkva'])
  })

  it('„Ostatné“ ukáže ingrediencie, ktoré kategóriu nemajú', async () => {
    const wrapper = await mountPantry()
    await choose(wrapper, 'Ostatné')
    expect(names(wrapper)).toEqual(['Soľ'])
  })

  it('filter funguje spolu s „Len čo mám doma“ a hľadaním', async () => {
    const wrapper = await mountPantry()
    await choose(wrapper, 'Zelenina')
    const onlyHome = wrapper.find('[data-test="only-home-chip"]')
    await onlyHome.trigger('click')
    expect(names(wrapper)).toEqual(['Mrkva'])
  })

  it('výber sa dá zrušiť a v angličtine je popis po anglicky', async () => {
    setLocale('en')
    const wrapper = await mountPantry()
    expect(wrapper.find('[data-test="pantry-category"]').text()).toContain('Category')
  })
})
