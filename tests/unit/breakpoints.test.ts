import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { useDisplay } from 'vuetify'
import { createAppVuetify } from '@/plugins/vuetify'

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
}

const desktopAt = (width: number) => {
  setViewport(width)
  let desktop = false
  mount(
    defineComponent({
      setup() {
        desktop = useDisplay().mdAndUp.value
        return () => h('div')
      },
    }),
    { global: { plugins: [createAppVuetify()] } },
  )
  return desktop
}

describe('hranica mobilnej verzie', () => {
  it('do 1200 px je mobilná verzia (spodná lišta, filtre v paneli), od 1200 px počítačová', () => {
    expect(desktopAt(390)).toBe(false)
    expect(desktopAt(1024)).toBe(false)
    expect(desktopAt(1199)).toBe(false)
    expect(desktopAt(1200)).toBe(true)
    expect(desktopAt(1440)).toBe(true)
  })
})
