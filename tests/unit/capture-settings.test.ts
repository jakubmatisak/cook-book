import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { importBookmarklet } from '@/features/settings/bookmarklet'
import SettingsPage from '@/features/settings/pages/SettingsPage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('importBookmarklet', () => {
  it('otvorí v novej karte import s adresou aktuálnej stránky', () => {
    const code = importBookmarklet('https://kniha.example.com')
    expect(code.startsWith('javascript:')).toBe(true)
    expect(code).toContain('"https://kniha.example.com/recepty/import?url="')
    expect(code).toContain('encodeURIComponent(location.href)')
    expect(code).toContain('window.open(')
  })

  it('koncové lomky v adrese sa odstránia a citáty v adrese neprerušia kód', () => {
    expect(importBookmarklet('https://a.sk//')).toContain('"https://a.sk/recepty/import?url="')
    expect(importBookmarklet('https://a.sk/"x')).toContain('\\"x')
  })
})

describe('Nastavenia: pridávanie receptov z internetu', () => {
  async function mountSettings() {
    stubApi({ '/me': me('member'), '/household/members': [], '/households': [] })
    const wrapper = mount(SettingsPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  it('má záložku na pretiahnutie, ktorá nesie adresu aplikácie', async () => {
    const wrapper = await mountSettings()
    const link = wrapper.find('[data-test="bookmarklet"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe(importBookmarklet(location.origin))
  })

  it('kliknutie na záložku v nastaveniach nič nespustí (je len na pretiahnutie)', async () => {
    const wrapper = await mountSettings()
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    wrapper.find('[data-test="bookmarklet"]').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('ponúka stiahnutie rozšírenia do Chromu a adresu aplikácie na vloženie', async () => {
    const wrapper = await mountSettings()
    const download = wrapper.find('[data-test="extension-download"]')
    expect(download.attributes('href')).toBe('/rozsirenie-kucharska-kniha.zip')
    expect(download.attributes('download')).toBeDefined()
    expect(wrapper.find('[data-test="app-address"]').text()).toContain(location.origin)
  })

  it('adresu aplikácie sa dá skopírovať', async () => {
    const wrapper = await mountSettings()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await wrapper.find('[data-test="copy-address"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(location.origin)
  })

  it('texty sú v jazyku aplikácie', async () => {
    setLocale('en')
    const wrapper = await mountSettings()
    expect(wrapper.find('[data-test="capture-card"]').text()).toContain('Add a recipe from the web')
  })

  it('karta je pre každého člena, nielen pre vlastníka', async () => {
    const wrapper = await mountSettings()
    expect(wrapper.find('[data-test="capture-card"]').exists()).toBe(true)
  })
})
