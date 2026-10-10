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

const ing = (id: string, name: string, usageCount: number): IngredientDto => ({
  id,
  name,
  defaultUnit: null,
  shopCategoryId: null,
  usageCount,
})

async function mountPage(extra: Record<string, unknown> = {}) {
  const calls = stubApi({
    '/me': me('owner'),
    '/ingredients': [ing('a', 'Banán', 4), ing('b', 'Banány', 1), ing('c', 'Mrkva', 2)],
    '/ingredients/starter': { total: 100, missing: 0 },
    '/shop-categories': [],
    '/ingredients/merge-ignored': [],
    '/ingredients/units': {},
    'POST /ingredients/merge': (call: StubCall) =>
      jsonResponse({ ...ing('a', (call.body as { name?: string }).name ?? 'Banán', 5) }),
    'POST /ingredients/merge-ignored': { ok: true },
    ...extra,
  })
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(IngredientsPage)) },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  return { calls, wrapper }
}

const click = async (selector: string) => {
  document.querySelector<HTMLElement>(selector)!.click()
  await flushPromises()
}

async function openSuggestions(wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper']) {
  await wrapper.find('[data-test="merge-suggestions"] .v-expansion-panel-title').trigger('click')
  await flushPromises()
}

describe('návrhy na zlúčenie v Ingredienciách', () => {
  it('ukáže skupinu duplicít a Zlúčiť otvorí okno s najpoužívanejšou ako cieľom', async () => {
    const { wrapper, calls } = await mountPage()
    const card = wrapper.find('[data-test="merge-suggestions"]')
    expect(card.text()).toContain('Návrhy na zlúčenie (1)')
    await openSuggestions(wrapper)
    expect(wrapper.find('[data-test="merge-suggestion"]').text()).toContain('Banán')
    expect(wrapper.find('[data-test="merge-suggestion"]').text()).toContain('Banány')
    await wrapper.find('[data-test="suggestion-merge"]').trigger('click')
    await flushPromises()
    await click('[data-test="merge-confirm"]')
    expect(calls.find((c) => c.method === 'POST' && c.path === '/ingredients/merge')?.body).toEqual({
      targetId: 'a',
      sourceIds: ['b'],
    })
  })

  it('Ignorovať si zapamätá skupinu a návrh zmizne', async () => {
    let ignored: string[] = []
    const { wrapper, calls } = await mountPage({
      '/ingredients/merge-ignored': () => jsonResponse(ignored),
      'POST /ingredients/merge-ignored': () => {
        ignored = ['a,b']
        return jsonResponse({ ok: true })
      },
    })
    await openSuggestions(wrapper)
    await wrapper.find('[data-test="suggestion-ignore"]').trigger('click')
    await flushPromises()
    expect(calls.find((c) => c.method === 'POST' && c.path === '/ingredients/merge-ignored')?.body).toEqual({
      ids: ['a', 'b'],
    })
    expect(wrapper.find('[data-test="merge-suggestions"]').exists()).toBe(false)
  })

  it('ignorované návrhy sa neukážu', async () => {
    const { wrapper } = await mountPage({ '/ingredients/merge-ignored': ['a,b'] })
    expect(wrapper.find('[data-test="merge-suggestions"]').exists()).toBe(false)
  })

  it('pri jednotkách, ktoré sa nedajú prepočítať, varuje a zlúčenie treba potvrdiť', async () => {
    const { wrapper, calls } = await mountPage({ '/ingredients/units': { a: ['g'], b: ['ks'] } })
    await openSuggestions(wrapper)
    await wrapper.find('[data-test="suggestion-merge"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-test="merge-units-warning"]')?.textContent).toContain('g, ks')
    // Pri každej ingrediencii vidno jej jednotky, nech je jasné, ktorá je ktorá.
    expect(document.querySelector('[data-test="merge-target-a"]')?.textContent).toContain('· g')
    expect(document.querySelector('[data-test="merge-target-b"]')?.textContent).toContain('· ks')
    expect(document.querySelector<HTMLButtonElement>('[data-test="merge-confirm"]')!.disabled).toBe(true)
    await click('[data-test="merge-units-confirm"] input')
    expect(document.querySelector<HTMLButtonElement>('[data-test="merge-confirm"]')!.disabled).toBe(false)
    await click('[data-test="merge-confirm"]')
    expect(calls.some((c) => c.method === 'POST' && c.path === '/ingredients/merge')).toBe(true)
  })

  it('g a kg sa dajú prepočítať – bez varovania', async () => {
    const { wrapper } = await mountPage({ '/ingredients/units': { a: ['g'], b: ['kg'] } })
    await openSuggestions(wrapper)
    await wrapper.find('[data-test="suggestion-merge"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-test="merge-units-warning"]')).toBeNull()
    expect(document.querySelector<HTMLButtonElement>('[data-test="merge-confirm"]')!.disabled).toBe(false)
  })

  it('pri rozdielnych jednotkách ukáže v karte červený štítok a jednotky pri ingredienciách', async () => {
    const { wrapper } = await mountPage({ '/ingredients/units': { a: ['g'], b: ['ks'] } })
    await openSuggestions(wrapper)
    const row = wrapper.find('[data-test="merge-suggestion"]')
    expect(row.find('[data-test="suggestion-mixed-units"]').exists()).toBe(true)
    expect(row.text()).toContain('Banán (v 4 receptoch, g)')
    expect(row.text()).toContain('Banány (v 1 recepte, ks)')
  })

  it('prepočet: 1 ks = 10 g zlúči bez potvrdzovania a pošle prepočet', async () => {
    const { wrapper, calls } = await mountPage({ '/ingredients/units': { a: ['g'], b: ['ks'] } })
    await openSuggestions(wrapper)
    await wrapper.find('[data-test="suggestion-merge"]').trigger('click')
    await flushPromises()
    const input = document.querySelector<HTMLInputElement>('[data-test="merge-convert-ks"] input')!
    input.value = '10'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(document.querySelector('[data-test="merge-units-confirm"]')).toBeNull()
    expect(document.querySelector<HTMLButtonElement>('[data-test="merge-confirm"]')!.disabled).toBe(false)
    await click('[data-test="merge-confirm"]')
    expect(calls.find((c) => c.method === 'POST' && c.path === '/ingredients/merge')?.body).toEqual({
      targetId: 'a',
      sourceIds: ['b'],
      convert: [{ from: 'ks', to: 'g', factor: 10 }],
    })
  })
})
