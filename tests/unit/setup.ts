import { config } from '@vue/test-utils'
import { i18n } from '@/i18n'

// Každý testovaný komponent má k dispozícii preklady (predvolený jazyk je slovenčina).
config.global.plugins = [...(config.global.plugins ?? []), i18n]

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

// jsdom nemá visualViewport, ktorý Vuetify používa pri umiestnení ponúk a okien.
if (typeof window !== 'undefined' && !('visualViewport' in window)) {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: {
      width: 1024,
      height: 768,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
      addEventListener() {},
      removeEventListener() {},
    },
  })
}
