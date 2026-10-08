import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { RecipeDetailDto } from '@shared/api'
import RecipeDetailPage from '@/features/recipes/pages/RecipeDetailPage.vue'
import { setLocale } from '@/i18n'
import { jsonResponse, me, mountPlugins, stubApi, type StubCall } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const detail = (shareToken: string | null): RecipeDetailDto => ({
  id: 'r1',
  title: 'Kôprová omáčka',
  slug: 'koprova',
  category: 'omacka',
  servings: 4,
  prepMinutes: null,
  cookMinutes: null,
  difficulty: 1,
  coverImageUrl: null,
  tags: [],
  isFavorite: false,
  visibility: 'private',
  createdAt: 'x',
  updatedAt: 'x',
  lastCookedAt: null,
  description: null,
  sourceUrl: null,
  sourceText: null,
  coverImageId: null,
  shareToken,
  ingredients: [],
  steps: [],
})

const Blank = defineComponent({ render: () => h('div') })

async function mountDetail(shareToken: string | null, extra: Record<string, unknown> = {}) {
  const writeText = vi.fn(async () => undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const calls = stubApi({ '/me': me('owner'), '/tags': [], '/recipes/r1': detail(shareToken), ...extra })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recipes/:id', component: Blank },
      { path: '/recipes', component: Blank },
    ],
  })
  await router.push('/recipes/r1')
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(RecipeDetailPage)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return { wrapper, calls, writeText, router }
}

const click = async (selector: string) => {
  document.body.querySelector<HTMLElement>(selector)!.click()
  await flushPromises()
}

describe('zdieľanie receptu odkazom v detaile', () => {
  it('Zdieľať odkazom vytvorí odkaz, skopíruje ho a recept hore ukáže ako zdieľaný', async () => {
    const { wrapper, calls, writeText } = await mountDetail(null, {
      'POST /recipes/r1/share': () => jsonResponse({ token: 'kod123', url: '/s/kod123' }),
    })
    expect(wrapper.find('[data-test="share-status"]').exists()).toBe(false)

    await wrapper.find('[aria-label="Ďalšie akcie"]').trigger('click')
    await flushPromises()
    await click('[data-test="share-link"]')

    expect(calls.some((c: StubCall) => c.method === 'POST' && c.path === '/recipes/r1/share')).toBe(true)
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/kod123`)
    expect(wrapper.find('[data-test="share-status"]').text()).toContain('Zdieľané')
    expect(document.body.textContent).toContain('Odkaz je skopírovaný')
  })

  it('zdieľaný recept má hore kopírovanie odkazu a zastavenie zdieľania', async () => {
    const { wrapper, calls, writeText } = await mountDetail('kod123', {
      'DELETE /recipes/r1/share': () => jsonResponse(null, 204),
    })
    expect(wrapper.find('[data-test="share-status"]').text()).toContain('Zdieľané')

    await click('[data-test="share-copy"]')
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/kod123`)

    await click('[data-test="share-stop"]')
    expect(calls.some((c: StubCall) => c.method === 'DELETE' && c.path === '/recipes/r1/share')).toBe(true)
    expect(wrapper.find('[data-test="share-status"]').exists()).toBe(false)
  })
})

describe('Späť v detaile receptu', () => {
  it('vedie vždy do receptov, nie na predošlú stránku v histórii (napr. režim varenia)', async () => {
    const { wrapper, router } = await mountDetail(null)
    await wrapper.find('[data-test="detail-back"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/recipes'))
  })
})
