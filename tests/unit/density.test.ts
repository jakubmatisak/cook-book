import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { VTextField } from 'vuetify/components'
import type { UserSettingsDto } from '@shared/userSettings'
import AppEffects from '@/components/AppEffects.vue'
import { densityDefaults } from '@/design/density'
import SettingsPage from '@/features/settings/pages/SettingsPage.vue'
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

const Field = defineComponent({ render: () => h(VTextField, { label: 'Názov', 'data-test': 'field' }) })

async function mountField(width: number, userSettings: UserSettingsDto = {}) {
  setViewport(width)
  stubApi({
    '/me': { ...me('owner'), userSettings },
    '/ingredients/starter': { missing: 0 },
  })
  const wrapper = mount(AppEffects, {
    slots: { default: () => h(Field) },
    global: { plugins: mountPlugins() },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const fieldDensity = (wrapper: Awaited<ReturnType<typeof mountField>>) =>
  wrapper
    .find('.v-input')
    .classes()
    .find((c) => c.startsWith('v-input--density-'))

describe('hustota rozhrania', () => {
  it('nastaví hustotu poliam, tlačidlám, zoznamom aj tabuľkám', () => {
    const defaults = densityDefaults('compact')
    for (const component of [
      'VTextField',
      'VSelect',
      'VNumberInput',
      'VBtn',
      'VList',
      'VDataTable',
      'VToolbar',
    ]) {
      expect(defaults[component], component).toEqual({ density: 'compact' })
    }
  })

  it('na mobile je vždy kompaktná, aj keď má človek na počítači inú', async () => {
    expect(fieldDensity(await mountField(390, { density: 'default' }))).toBe('v-input--density-compact')
  })

  it('na počítači je predvolene pohodlná a inak podľa nastavenia človeka', async () => {
    expect(fieldDensity(await mountField(1280))).toBe('v-input--density-comfortable')
    document.body.innerHTML = ''
    expect(fieldDensity(await mountField(1280, { density: 'default' }))).toBe('v-input--density-default')
  })
})

describe('nastavenie „Hustota rozhrania“', () => {
  async function mountSettings(userSettings: UserSettingsDto = {}) {
    setViewport(1280)
    const calls = stubApi({
      '/me': { ...me('member'), userSettings },
      'PUT /me/settings': {},
    })
    const wrapper = mount(SettingsPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
    await flushPromises()
    return { calls, wrapper }
  }
  const puts = (calls: { method: string; path: string; body: unknown }[]) =>
    calls.filter((c) => c.method === 'PUT' && c.path === '/me/settings').map((c) => c.body)

  it('uloží zvolenú hustotu k človeku; pohodlná je predvolená, preto sa zmaže (null)', async () => {
    const { calls, wrapper } = await mountSettings({ density: 'default' })
    expect(wrapper.text()).toContain('Hustota rozhrania')
    await wrapper.find('[data-test="density-compact"]').trigger('click')
    await wrapper.find('[data-test="density-comfortable"]').trigger('click')
    await flushPromises()
    expect(puts(calls)).toEqual([{ density: 'compact' }, { density: null }])
  })
})
