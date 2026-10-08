import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SettingsPage from '@/features/settings/pages/SettingsPage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

async function mountSettings(kidsEnabled?: boolean) {
  const base = me('member')
  const calls = stubApi({
    '/me': { ...base, userSettings: kidsEnabled === undefined ? {} : { kidsEnabled } },
    'PUT /me/settings': { kidsEnabled: false },
  })
  const wrapper = mount(SettingsPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
  await flushPromises()
  return { calls, wrapper }
}

describe('nastavenie „Detské recepty“', () => {
  it('je predvolene zapnuté a má popis', async () => {
    const { wrapper } = await mountSettings()
    const input = wrapper.find('[data-test="kids-switch"] input')
    expect((input.element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.text()).toContain('Detské recepty')
  })

  it('vypnutie uloží kidsEnabled=false k človeku', async () => {
    const { calls, wrapper } = await mountSettings()
    await wrapper.find('[data-test="kids-switch"] input').setValue(false)
    await flushPromises()
    const put = calls.find((c) => c.method === 'PUT' && c.path === '/me/settings')
    expect(put?.body).toEqual({ kidsEnabled: false })
  })

  it('zapnutie vymaže nastavenie (null), lebo zapnuté je predvolené', async () => {
    const { calls, wrapper } = await mountSettings(false)
    await wrapper.find('[data-test="kids-switch"] input').setValue(true)
    await flushPromises()
    const put = calls.find((c) => c.method === 'PUT' && c.path === '/me/settings')
    expect(put?.body).toEqual({ kidsEnabled: null })
  })
})

describe('nastavenie „Zobrazovať recepty od iných“', () => {
  it('je predvolene vypnuté; zapnutie uloží showOthersRecipes=true, vypnutie ho vymaže', async () => {
    const { calls, wrapper } = await mountSettings()
    const input = wrapper.find('[data-test="others-switch"] input')
    expect((input.element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.text()).toContain('Zobrazovať recepty od iných')

    await input.setValue(true)
    await flushPromises()
    const puts = calls.filter((c) => c.method === 'PUT' && c.path === '/me/settings')
    expect(puts.at(-1)?.body).toEqual({ showOthersRecipes: true })
  })
})
