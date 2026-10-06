import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { VApp } from 'vuetify/components'
import type { IngredientDto } from '@shared/api'
import PantryPage from '@/features/pantry/pages/PantryPage.vue'
import { setLocale } from '@/i18n'
import { jsonResponse, me, mountPlugins, stubApi, type StubCall } from './helpers/apiStub'

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

async function mountPantry(extra: Record<string, unknown> = {}) {
  const calls = stubApi({
    '/me': me('owner'),
    '/ingredients': [ing('i1', 'Mrkva', 'c1')],
    '/shop-categories': [
      { id: 'c1', name: 'Zelenina', sortOrder: 1 },
      { id: 'c2', name: 'Mliečne', sortOrder: 2 },
    ],
    '/pantry': { ingredientIds: [], items: [] },
    '/staples': [],
    'POST /ingredients': (call: StubCall) =>
      jsonResponse(
        {
          id: 'new1',
          name: (call.body as { name: string }).name,
          defaultUnit: null,
          shopCategoryId: (call.body as { shopCategoryId: string | null }).shopCategoryId,
          usageCount: 0,
        },
        201,
      ),
    'PUT /pantry/new1': () => new Response(null, { status: 204 }),
    ...extra,
  })
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(PantryPage)) },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  return { calls, wrapper }
}

const body = () => document.body
const field = (test: string) => body().querySelector<HTMLInputElement>(`[data-test="${test}"] input`)

async function type(test: string, value: string) {
  const input = field(test)!
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}

async function chooseCategory(text: string) {
  body()
    .querySelector<HTMLElement>('[data-test="new-category"] .v-field')!
    .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  await flushPromises()
  const option = [...body().querySelectorAll<HTMLElement>('.v-overlay .v-list-item')].find((el) =>
    el.textContent?.includes(text),
  )
  expect(option, text).toBeDefined()
  option!.click()
  await flushPromises()
}

const save = async () => {
  body().querySelector<HTMLElement>('[data-test="new-save"]')!.click()
  await flushPromises()
}
const posted = (calls: StubCall[]) => calls.find((c) => c.method === 'POST' && c.path === '/ingredients')

describe('Špajza: ručné pridanie novej suroviny', () => {
  it('v karte Doma je na boku tlačidlo „Pridať surovinu“, v Stálych položkách nie', async () => {
    const { wrapper } = await mountPantry()
    expect(wrapper.find('[data-test="add-ingredient"]').exists()).toBe(true)
    await wrapper.find('[data-test="tab-staples"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="add-ingredient"]').exists()).toBe(false)
  })

  it('vytvorí novú ingredienciu s kategóriou a rovno ju označí, že ju mám doma', async () => {
    const { calls, wrapper } = await mountPantry()
    await wrapper.find('[data-test="add-ingredient"]').trigger('click')
    await flushPromises()
    await type('new-name', 'Syr tvrdý')
    await chooseCategory('Mliečne')
    await save()
    expect(posted(calls)?.body).toEqual({ name: 'Syr tvrdý', shopCategoryId: 'c2', defaultUnit: null })
    expect(calls.some((c) => c.method === 'PUT' && c.path === '/pantry/new1')).toBe(true)
    // dialóg sa zavrie
    expect(wrapper.findComponent({ name: 'NewIngredientDialog' }).props('modelValue')).toBe(false)
  })

  it('bez zaškrtnutého „Mám to doma“ sa len vytvorí surovina', async () => {
    const { calls, wrapper } = await mountPantry()
    await wrapper.find('[data-test="add-ingredient"]').trigger('click')
    await flushPromises()
    await type('new-name', 'Syr tvrdý')
    body().querySelector<HTMLInputElement>('[data-test="new-at-home"] input')!.click()
    await flushPromises()
    await save()
    expect(posted(calls)).toBeDefined()
    expect(calls.some((c) => c.method === 'PUT' && c.path.startsWith('/pantry/'))).toBe(false)
  })

  it('prázdny názov sa neodošle', async () => {
    const { calls, wrapper } = await mountPantry()
    await wrapper.find('[data-test="add-ingredient"]').trigger('click')
    await flushPromises()
    await save()
    expect(posted(calls)).toBeUndefined()
    expect(body().textContent).toContain('Zadaj názov suroviny.')
  })

  it('chybu servera (napr. surovina už existuje) ukáže v okne', async () => {
    const { wrapper } = await mountPantry({
      'POST /ingredients': () =>
        jsonResponse({ error: { code: 'duplicate', message: 'Ingrediencia „Mrkva“ už existuje.' } }, 409),
    })
    await wrapper.find('[data-test="add-ingredient"]').trigger('click')
    await flushPromises()
    await type('new-name', 'Mrkva')
    await save()
    expect(body().textContent).toContain('Ingrediencia „Mrkva“ už existuje.')
    expect(body().querySelector('[data-test="new-save"]')).not.toBeNull()
  })

  it('keď hľadanie nič nenájde, ponúkne pridanie hľadanej suroviny s predvyplneným názvom', async () => {
    const { wrapper } = await mountPantry()
    const search = wrapper.find('input[type="text"]')
    await search.setValue('syr tvrdý')
    await flushPromises()
    const offer = wrapper.find('[data-test="add-from-search"]')
    expect(offer.exists()).toBe(true)
    expect(offer.text()).toContain('syr tvrdý')
    await offer.trigger('click')
    await flushPromises()
    expect(field('new-name')!.value).toBe('syr tvrdý')
  })

  it('texty sú po anglicky', async () => {
    setLocale('en')
    const { wrapper } = await mountPantry()
    expect(wrapper.find('[data-test="add-ingredient"]').text()).toContain('Add ingredient')
  })
})
