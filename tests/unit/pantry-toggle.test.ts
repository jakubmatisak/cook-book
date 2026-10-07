import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { VApp } from 'vuetify/components'
import type { IngredientDto } from '@shared/api'
import PantryPage from '@/features/pantry/pages/PantryPage.vue'
import { setLocale } from '@/i18n'
import { jsonResponse, me, mountPlugins } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const ing = (id: string, name: string): IngredientDto => ({
  id,
  name,
  defaultUnit: null,
  shopCategoryId: null,
  usageCount: 0,
})

/**
 * Falošný server: GET /pantry vracia, čo server naozaj uložil; PUT čaká, kým ho test pustí (pomalé spojenie).
 */
function slowServer() {
  const saved = new Set<string>()
  const pending: (() => void)[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const path = String(url).replace('/api/v1', '').split('?')[0]!
      const method = init?.method ?? 'GET'
      if (path === '/me') return Promise.resolve(jsonResponse(me('owner')))
      if (path === '/ingredients')
        return Promise.resolve(jsonResponse([ing('a', 'Mrkva'), ing('b', 'Cibuľa')]))
      if (path === '/shop-categories' || path === '/staples') return Promise.resolve(jsonResponse([]))
      if (path === '/pantry') return Promise.resolve(jsonResponse({ ingredientIds: [...saved], items: [] }))
      const id = path.replace('/pantry/', '')
      if (method === 'PUT')
        return new Promise((resolve) =>
          pending.push(() => {
            saved.add(id)
            resolve(new Response(null, { status: 204 }))
          }),
        )
      return Promise.resolve(jsonResponse({}, 404))
    }),
  )
  return { finishNext: () => pending.shift()?.() }
}

const checked = (name: string) =>
  [...document.body.querySelectorAll<HTMLElement>('.v-list-item')]
    .find((el) => el.textContent?.includes(name))
    ?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked

const click = async (name: string) => {
  ;[...document.body.querySelectorAll<HTMLElement>('.v-list-item')]
    .find((el) => el.textContent?.includes(name))!
    .click()
  await flushPromises()
}

describe('Špajza: zaškrtnutie „mám doma“', () => {
  it('sa ukáže hneď, bez čakania na server', async () => {
    slowServer()
    mount(
      { render: () => h(VApp, null, () => h(PantryPage)) },
      { global: { plugins: mountPlugins() }, attachTo: document.body },
    )
    await flushPromises()
    await click('Mrkva')
    expect(checked('Mrkva')).toBe(true)
  })

  it('rýchlo za sebou zaškrtnuté veci ostanú zaškrtnuté, aj keď server odpovedá postupne', async () => {
    const server = slowServer()
    mount(
      { render: () => h(VApp, null, () => h(PantryPage)) },
      { global: { plugins: mountPlugins() }, attachTo: document.body },
    )
    await flushPromises()
    await click('Mrkva')
    await click('Cibuľa')
    // Server uloží Mrkvu; Cibuľa ešte čaká. Načítanie špajze nesmie Cibuľu odškrtnúť.
    server.finishNext()
    await flushPromises()
    expect(checked('Mrkva')).toBe(true)
    expect(checked('Cibuľa')).toBe(true)
    server.finishNext()
    await flushPromises()
    expect(checked('Cibuľa')).toBe(true)
  })
})

describe('Špajza: zaškrtnutie je lacné', () => {
  const pantryGets = () =>
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url, init]) => String(url).includes('/pantry') && !String(url).includes('/pantry/') && !init?.method,
    ).length

  it('po uložení sa špajza znova nesťahuje (server má to isté, čo už vidno)', async () => {
    const server = slowServer()
    mount(
      { render: () => h(VApp, null, () => h(PantryPage)) },
      { global: { plugins: mountPlugins() }, attachTo: document.body },
    )
    await flushPromises()
    const before = pantryGets()
    await click('Mrkva')
    server.finishNext()
    await flushPromises()
    expect(checked('Mrkva')).toBe(true)
    expect(pantryGets()).toBe(before)
  })

  it('prepočíta sa len zaškrtnutý riadok, ostatné riadky zoznamu sa vôbec neaktualizujú', async () => {
    slowServer()
    // Každá aktualizácia riadku (VListItem) sa zapíše s jeho textom.
    const updated: string[] = []
    const countRowUpdates = {
      updated(this: { $options: { name?: string }; $el?: Element }) {
        if (this.$options.name === 'VListItem') updated.push(this.$el?.textContent?.trim() ?? '')
      },
    }
    mount(
      { render: () => h(VApp, null, () => h(PantryPage)) },
      { global: { plugins: mountPlugins(), mixins: [countRowUpdates] }, attachTo: document.body },
    )
    await flushPromises()
    updated.length = 0
    await click('Mrkva')
    expect(checked('Mrkva')).toBe(true)
    expect(updated.filter((text) => !text.includes('Mrkva'))).toEqual([])
  })
})
