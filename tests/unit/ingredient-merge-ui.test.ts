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

async function mountPage() {
  const calls = stubApi({
    '/me': me('owner'),
    '/ingredients': [ing('a', 'Banán', 4), ing('b', 'Banány', 1), ing('c', 'Mrkva', 2)],
    '/ingredients/starter': { total: 100, missing: 0 },
    '/shop-categories': [],
    'POST /ingredients/merge': (call: StubCall) =>
      jsonResponse({ ...ing('a', (call.body as { name?: string }).name ?? 'Banán', 5) }),
  })
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(IngredientsPage)) },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  await wrapper.find('[data-test="select-mode"]').trigger('click')
  await flushPromises()
  return { calls, wrapper }
}

const select = async (wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'], id: string) => {
  await wrapper.find(`[data-test="select-${id}"] input`).setValue(true)
  await flushPromises()
}

describe('zlúčenie ingrediencií v Ingredienciách', () => {
  it('Zlúčiť je dostupné až pri dvoch vybraných', async () => {
    const { wrapper } = await mountPage()
    await select(wrapper, 'a')
    expect(wrapper.find('[data-test="bulk-merge"]').attributes('disabled')).toBeDefined()
    await select(wrapper, 'b')
    expect(wrapper.find('[data-test="bulk-merge"]').attributes('disabled')).toBeUndefined()
  })

  it('predvolene ostane najpoužívanejšia; zlúčenie pošle cieľ a zlučované a oznámi výsledok', async () => {
    const { calls, wrapper } = await mountPage()
    await select(wrapper, 'b')
    await select(wrapper, 'a')
    await wrapper.find('[data-test="bulk-merge"]').trigger('click')
    await flushPromises()
    const dialog = document.body.querySelector<HTMLElement>('[data-test="merge-dialog"]')!
    expect(dialog.textContent).toContain('Banány sa zlúči do Banán')
    document.body.querySelector<HTMLElement>('[data-test="merge-confirm"]')!.click()
    await flushPromises()
    const post = calls.find((c) => c.method === 'POST' && c.path === '/ingredients/merge')
    expect(post?.body).toEqual({ targetId: 'a', sourceIds: ['b'] })
    expect(document.body.textContent).toContain('Zlúčené do Banán')
  })

  it('ponechať sa dá aj inú a premenovať ju', async () => {
    const { calls, wrapper } = await mountPage()
    await select(wrapper, 'a')
    await select(wrapper, 'b')
    await wrapper.find('[data-test="bulk-merge"]').trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLInputElement>('[data-test="merge-target-b"] input')!.click()
    await flushPromises()
    const name = document.body.querySelector<HTMLInputElement>('[data-test="merge-name"] input')!
    expect(name.value).toBe('Banány')
    name.value = 'Banány zrelé'
    name.dispatchEvent(new Event('input'))
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-test="merge-confirm"]')!.click()
    await flushPromises()
    const post = calls.find((c) => c.method === 'POST' && c.path === '/ingredients/merge')
    expect(post?.body).toEqual({ targetId: 'b', sourceIds: ['a'], name: 'Banány zrelé' })
  })
})
