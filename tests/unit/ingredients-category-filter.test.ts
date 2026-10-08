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

async function mountPage(width = 1280) {
  setViewport(width)
  stubApi({
    '/me': me('owner'),
    '/ingredients': [
      ing('i1', 'Kuracie prsia', 'maso'),
      ing('i2', 'Mleté mäso', 'maso'),
      ing('i3', 'Mrkva', 'zel'),
      ing('i4', 'Soľ', null),
    ],
    '/ingredients/starter': { total: 100, missing: 0 },
    '/shop-categories': [
      { id: 'zel', name: 'Zelenina', sortOrder: 1 },
      { id: 'maso', name: 'Mäso', sortOrder: 2 },
    ],
  })
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(IngredientsPage)) },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  return wrapper
}

const names = (wrapper: Awaited<ReturnType<typeof mountPage>>) =>
  wrapper.findAll('[data-test="ingredient-row"] .text-body-large').map((el) => el.text())

const options = async () => {
  await flushPromises()
  return [...document.body.querySelectorAll<HTMLElement>('.v-overlay .v-list-item')]
}

async function choose(selector: string, text: string) {
  document.body.querySelector<HTMLElement>(`${selector} .v-field`)!.dispatchEvent(new MouseEvent('mousedown'))
  const option = (await options()).find((el) => el.textContent?.includes(text))
  expect(option, text).toBeDefined()
  option!.click()
  await flushPromises()
}

describe('Ingrediencie: filter podľa kategórie', () => {
  it('výber kategórie ukáže len jej ingrediencie (napr. len mäso), v ponuke sú počty', async () => {
    const wrapper = await mountPage()
    expect(names(wrapper)).toEqual(['Kuracie prsia', 'Mleté mäso', 'Mrkva', 'Soľ'])
    document.body
      .querySelector<HTMLElement>('[data-test="ingredients-category"] .v-field')!
      .dispatchEvent(new MouseEvent('mousedown'))
    expect((await options()).map((el) => el.textContent?.trim())).toEqual([
      'Zelenina (1)',
      'Mäso (2)',
      'Bez kategórie (1)',
    ])
    ;(await options()).find((el) => el.textContent?.includes('Mäso (2)'))!.click()
    await flushPromises()
    expect(names(wrapper)).toEqual(['Kuracie prsia', 'Mleté mäso'])
  })

  it('„Bez kategórie“ ukáže ingrediencie, ktoré kategóriu nemajú', async () => {
    const wrapper = await mountPage()
    await choose('[data-test="ingredients-category"]', 'Bez kategórie')
    expect(names(wrapper)).toEqual(['Soľ'])
  })

  it('na mobile je kategória v spodnom paneli Filtre a počet sa ukáže na tlačidle', async () => {
    const wrapper = await mountPage(390)
    expect(document.body.querySelector('[data-test="ingredients-category"]')).toBeNull()
    await wrapper.find('[data-test="ingredients-filters-button"]').trigger('click')
    await flushPromises()
    await choose('[data-test="ingredients-category"]', 'Mäso')
    expect(names(wrapper)).toEqual(['Kuracie prsia', 'Mleté mäso'])
    const badge = wrapper.find('[data-test="ingredients-filters-button"]').element.closest('.v-badge')
    expect(badge?.querySelector('.v-badge__badge')?.textContent).toContain('1')
  })
})
