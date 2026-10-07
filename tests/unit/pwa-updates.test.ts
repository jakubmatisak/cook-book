import { describe, expect, it, vi } from 'vitest'
import { reloadOnNavigation, watchForUpdates } from '@/lib/pwaUpdates'

/** Falošný dokument: len stav viditeľnosti a udalosť jej zmeny. */
function fakeDocument() {
  const listeners: (() => void)[] = []
  return {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_type: 'visibilitychange', listener: () => void) => listeners.push(listener),
    removeEventListener: () => {},
    fire(state: DocumentVisibilityState) {
      this.visibilityState = state
      listeners.forEach((l) => l())
    },
  }
}

describe('kontrola novej verzie aplikácie', () => {
  it('pri návrate do aplikácie skontroluje, či na serveri nie je nová verzia', () => {
    const update = vi.fn(async () => undefined)
    const doc = fakeDocument()
    watchForUpdates({ update }, doc)
    expect(update).not.toHaveBeenCalled()

    doc.fire('hidden')
    expect(update).not.toHaveBeenCalled()
    doc.fire('visible')
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('chyba pri kontrole (bez signálu) aplikáciu nezhodí', async () => {
    const update = vi.fn(async () => {
      throw new Error('offline')
    })
    const doc = fakeDocument()
    watchForUpdates({ update }, doc)
    expect(() => doc.fire('visible')).not.toThrow()
    await Promise.resolve()
  })
})

describe('nová verzia a chýbajúce súbory stránok pri prechode v menu', () => {
  const setup = async () => {
    const { createRouter, createMemoryHistory } = await import('vue-router')
    const { defineComponent, h } = await import('vue')
    const Page = defineComponent({ render: () => h('div') })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: Page },
        { path: '/recipes', component: Page },
        {
          path: '/shopping',
          component: () =>
            Promise.reject(
              new TypeError('Failed to fetch dynamically imported module: /assets/ShoppingPage-old.js'),
            ),
        },
      ],
    })
    const hardNavigate = vi.fn()
    const updates = reloadOnNavigation(router, hardNavigate)
    await router.push('/')
    return { router, hardNavigate, updates }
  }

  it('bez novej verzie sa prechádza normálne, bez načítania celej stránky', async () => {
    const { router, hardNavigate } = await setup()
    await router.push('/recipes')
    expect(router.currentRoute.value.path).toBe('/recipes')
    expect(hardNavigate).not.toHaveBeenCalled()
  })

  it('keď je pripravená nová verzia, ďalšie ťuknutie v menu otvorí cieľ už v novej verzii (nič sa nestratí)', async () => {
    const { router, hardNavigate, updates } = await setup()
    updates.markReady()
    expect(hardNavigate).not.toHaveBeenCalled()
    await router.push('/recipes?pantry=1')
    expect(hardNavigate).toHaveBeenCalledWith('/recipes?pantry=1')
  })

  it('keď súbor stránky po vydaní na serveri už nie je, cieľ sa načíta celý znova namiesto zaseknutia', async () => {
    const { router, hardNavigate } = await setup()
    await router.push('/shopping').catch(() => {})
    expect(hardNavigate).toHaveBeenCalledWith('/shopping')
  })
})
