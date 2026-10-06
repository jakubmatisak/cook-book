import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useFlushOnHide } from '@/composables/useFlushOnHide'

function setup(flush: () => void) {
  return mount(
    defineComponent({
      setup() {
        useFlushOnHide(flush)
        return () => h('div')
      },
    }),
  )
}

const hide = () => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  document.dispatchEvent(new Event('visibilitychange'))
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
}

describe('useFlushOnHide', () => {
  it('zavolá flush pri pagehide (zatvorenie, obnovenie) aj keď sa karta skryje', () => {
    const flush = vi.fn()
    setup(flush)
    window.dispatchEvent(new Event('pagehide'))
    expect(flush).toHaveBeenCalledTimes(1)
    hide()
    expect(flush).toHaveBeenCalledTimes(2)
  })

  it('pri zobrazení karty flush nevolá a po odchode zo stránky prestane počúvať', () => {
    const flush = vi.fn()
    const wrapper = setup(flush)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(flush).not.toHaveBeenCalled()
    wrapper.unmount()
    window.dispatchEvent(new Event('pagehide'))
    expect(flush).not.toHaveBeenCalled()
  })
})
