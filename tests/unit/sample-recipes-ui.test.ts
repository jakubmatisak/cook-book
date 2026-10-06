import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { VApp } from 'vuetify/components'
import { setLocale } from '@/i18n'
import SettingsPage from '@/features/settings/pages/SettingsPage.vue'
import SampleRecipesButton from '@/features/recipes/components/SampleRecipesButton.vue'
import { jsonResponse, me, mountPlugins, stubApi } from './helpers/apiStub'

/** Falošný server: dávky po 4 recepty z 21, ako skutočný. */
function batches(total: number) {
  let remaining = total
  return () => {
    const added = Math.min(4, remaining)
    remaining -= added
    return jsonResponse({ added, remaining })
  }
}

async function mountButton() {
  const calls = stubApi({ 'POST /recipes/samples': batches(21) })
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(SampleRecipesButton)) },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  return { calls, wrapper }
}

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('Ukážkové recepty – tlačidlo', () => {
  it('volá server po dávkach, kým nie sú všetky, a ohlási počet', async () => {
    const { calls, wrapper } = await mountButton()
    await wrapper.find('[data-test="sample-recipes"]').trigger('click')
    await flushPromises()
    const posts = calls.filter((c) => c.method === 'POST' && c.path === '/recipes/samples')
    expect(posts).toHaveLength(6) // 4 + 4 + 4 + 4 + 4 + 1
    expect(document.body.textContent).toContain('Pridané: 21 receptov.')
  })

  it('keď už všetko je, povie to a nič nehlási ako pridané', async () => {
    stubApi({ 'POST /recipes/samples': () => jsonResponse({ added: 0, remaining: 0 }) })
    const wrapper = mount(
      { render: () => h(VApp, null, () => h(SampleRecipesButton)) },
      { global: { plugins: mountPlugins() }, attachTo: document.body },
    )
    await wrapper.find('[data-test="sample-recipes"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Všetky ukážkové recepty už máš.')
  })

  it('v angličtine ohlási po anglicky', async () => {
    setLocale('en')
    const { wrapper } = await mountButton()
    expect(wrapper.text()).toContain('Add sample recipes')
    await wrapper.find('[data-test="sample-recipes"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Added: 21 recipes.')
  })

  it('chybu servera ukáže používateľovi', async () => {
    stubApi({
      'POST /recipes/samples': () =>
        jsonResponse(
          { error: { code: 'owner_required', message: 'Túto zmenu môže urobiť len vlastník domácnosti.' } },
          403,
        ),
    })
    const wrapper = mount(
      { render: () => h(VApp, null, () => h(SampleRecipesButton)) },
      { global: { plugins: mountPlugins() }, attachTo: document.body },
    )
    await wrapper.find('[data-test="sample-recipes"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Túto zmenu môže urobiť len vlastník domácnosti.')
  })
})

describe('Detské ukážkové recepty – tlačidlo', () => {
  it('volá server so sadou kids po dávkach a ohlási počet', async () => {
    const calls = stubApi({ 'POST /recipes/samples': batches(23) })
    const wrapper = mount(
      { render: () => h(VApp, null, () => h(SampleRecipesButton, { set: 'kids' })) },
      { global: { plugins: mountPlugins() }, attachTo: document.body },
    )
    expect(wrapper.text()).toContain('Pridať detské recepty')
    await wrapper.find('[data-test="sample-recipes-kids"]').trigger('click')
    await flushPromises()
    const posts = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) =>
      String(c[0]),
    )
    expect(posts.every((u) => u.includes('/recipes/samples?set=kids') || !u.includes('samples'))).toBe(true)
    expect(calls.filter((c) => c.path === '/recipes/samples')).toHaveLength(6) // 4 × 5 + 3
    expect(document.body.textContent).toContain('Pridané: 23 receptov.')
  })
})

describe('Ukážkové recepty v Nastaveniach', () => {
  async function mountSettings(role: 'owner' | 'member') {
    stubApi({ '/me': me(role), '/household/members': [], '/households': [{ id: 'h1', name: 'Doma', role }] })
    const wrapper = mount(SettingsPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  it('detské tlačidlo je len keď sú detské recepty zapnuté', async () => {
    expect((await mountSettings('owner')).find('[data-test="sample-recipes-kids"]').exists()).toBe(true)
    document.body.innerHTML = ''
    stubApi({
      '/me': { ...me('owner'), userSettings: { kidsEnabled: false } },
      '/household/members': [],
      '/households': [{ id: 'h1', name: 'Doma', role: 'owner' }],
    })
    const off = mount(SettingsPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
    await flushPromises()
    expect(off.find('[data-test="samples-card"]').exists()).toBe(true)
    expect(off.find('[data-test="sample-recipes-kids"]').exists()).toBe(false)
  })

  it('vlastník ich vidí, člen nie', async () => {
    expect((await mountSettings('owner')).find('[data-test="samples-card"]').exists()).toBe(true)
    document.body.innerHTML = ''
    expect((await mountSettings('member')).find('[data-test="samples-card"]').exists()).toBe(false)
  })
})
