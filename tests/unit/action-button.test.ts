import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mdiPlus } from '@mdi/js'
import ActionButton from '@/components/ActionButton.vue'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
}

const mountButton = (width: number) => {
  setViewport(width)
  stubApi({ '/me': me('owner') })
  return mount(ActionButton, {
    props: { icon: mdiPlus, label: 'Pridať surovinu', color: 'primary' },
    global: { plugins: mountPlugins() },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('akčné tlačidlo v hlavičke stránky', () => {
  it('na mobile je len ikonka (viditeľná) s popisom pre čítačky', () => {
    const wrapper = mountButton(390)
    expect(wrapper.text()).toBe('')
    expect(wrapper.find('.v-icon svg').exists()).toBe(true)
    expect(wrapper.attributes('aria-label')).toBe('Pridať surovinu')
  })

  it('na počítači má ikonku aj text', () => {
    const wrapper = mountButton(1280)
    expect(wrapper.text()).toContain('Pridať surovinu')
    expect(wrapper.find('.v-icon svg').exists()).toBe(true)
  })
})
