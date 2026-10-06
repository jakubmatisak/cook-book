import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { householdsKey } from '@/api/households'
import { h } from 'vue'
import HouseholdGate from '@/features/households/components/HouseholdGate.vue'
import { activeHouseholdId, clearActiveHousehold } from '@/lib/household'
import { createAppVuetify } from '@/plugins/vuetify'

function stubFetch(households: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(households), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  )
}

async function mountGate() {
  const wrapper = mount(HouseholdGate, {
    global: {
      plugins: [
        createAppVuetify(),
        [VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }],
      ],
    },
    slots: { default: () => h('p', { 'data-test': 'content' }, 'obsah') },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  vi.unstubAllGlobals()
  clearActiveHousehold()
  localStorage.clear()
  document.body.innerHTML = ''
})

const home = (id: string, name: string) => ({ id, name, role: 'owner' })

describe('HouseholdGate', () => {
  it('jedinú domácnosť zvolí sama a pustí obsah bez výberu', async () => {
    stubFetch([home('a', 'Doma')])
    const wrapper = await mountGate()
    expect(wrapper.find('[data-test="content"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="household-picker"]').exists()).toBe(false)
    expect(activeHouseholdId()).toBe('a')
  })

  it('pri viacerých domácnostiach žiada výber a po kliknutí pustí obsah', async () => {
    stubFetch([home('a', 'Doma'), home('b', 'Rodičia')])
    const wrapper = await mountGate()
    expect(wrapper.find('[data-test="content"]').exists()).toBe(false)
    const options = wrapper.findAll('[data-test="household-option"]')
    expect(options.map((o) => o.text())).toEqual([
      expect.stringContaining('Doma'),
      expect.stringContaining('Rodičia'),
    ])

    await options[1]!.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="content"]').exists()).toBe(true)
    expect(activeHouseholdId()).toBe('b')
  })

  it('platnú domácnosť zvolenú v tomto okne použije bez opýtania', async () => {
    sessionStorage.setItem('kniha:household', 'b')
    stubFetch([home('a', 'Doma'), home('b', 'Rodičia')])
    const wrapper = await mountGate()
    expect(wrapper.find('[data-test="content"]').exists()).toBe(true)
    expect(activeHouseholdId()).toBe('b')
  })

  it('bez členstva ukáže vysvetlenie a obsah nepustí', async () => {
    stubFetch([])
    const wrapper = await mountGate()
    expect(wrapper.find('[data-test="content"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Nie si členom žiadnej domácnosti')
  })

  it('pri chybe načítania ponúkne skúsiť znova', async () => {
    stubFetch({ error: { code: 'server', message: 'Chyba servera' } }, 500)
    const wrapper = await mountGate()
    expect(wrapper.find('[data-test="content"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Skúsiť znova')
  })
})

describe('HouseholdGate – zmena domácností počas relácie', () => {
  it('keď aktívna domácnosť zanikne (odobratý člen), aplikácia sa načíta odznova', async () => {
    vi.resetModules()
    const reloadApp = vi.fn()
    vi.doMock('@/lib/household', async (original) => ({
      ...(await original<typeof import('@/lib/household')>()),
      reloadApp,
    }))
    const { default: Gate } = await import('@/features/households/components/HouseholdGate.vue')
    const { QueryClient: QC, VueQueryPlugin: VQ } = await import('@tanstack/vue-query')
    const client = new QC({ defaultOptions: { queries: { retry: false } } })

    stubFetch([home('a', 'Doma'), home('b', 'Rodičia')])
    sessionStorage.setItem('kniha:household', 'a')
    const wrapper = mount(Gate, {
      global: { plugins: [createAppVuetify(), [VQ, { queryClient: client }]] },
      slots: { default: () => h('p', { 'data-test': 'content' }, 'obsah') },
      attachTo: document.body,
    })
    await flushPromises()
    expect(wrapper.find('[data-test="content"]').exists()).toBe(true)
    expect(reloadApp).not.toHaveBeenCalled()

    stubFetch([home('b', 'Rodičia')]) // z domácnosti a už nie je členom
    await client.invalidateQueries({ queryKey: householdsKey })
    await flushPromises()
    expect(reloadApp).toHaveBeenCalledTimes(1)
    vi.doUnmock('@/lib/household')
  })
})
