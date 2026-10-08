import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { reloadOnNavigation, watchForUpdates } from '@/lib/pwaUpdates'

/** Prázdna stránka pre testovací router. */
const Page = defineComponent({ render: () => h('div') })

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
    const data = new Map<string, string>()
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    }
    const updates = reloadOnNavigation(router, hardNavigate, { storage, now: () => Date.now() })
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

describe('poistka proti nekonečnému obnovovaniu', () => {
  /** Úložisko zdieľané medzi „načítaniami stránky“ – každé načítanie je nová inštancia reloadOnNavigation. */
  const memoryStorage = () => {
    const data = new Map<string, string>()
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    }
  }

  const load = async (storage: ReturnType<typeof memoryStorage>, now: () => number) => {
    const { createRouter, createMemoryHistory } = await import('vue-router')
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: Page },
        { path: '/recipes', component: Page },
        {
          path: '/shopping',
          component: () =>
            Promise.reject(
              new TypeError('Failed to fetch dynamically imported module: /assets/Shopping-old.js'),
            ),
        },
      ],
    })
    const hardNavigate = vi.fn()
    const updates = reloadOnNavigation(router, hardNavigate, { storage, now })
    await router.push('/')
    return { router, hardNavigate, updates }
  }

  it('stránku znova načíta najviac raz za 15 s; ďalší prechod ostane v aplikácii', async () => {
    const storage = memoryStorage()
    let time = 1_000_000
    const first = await load(storage, () => time)
    first.updates.markReady()
    await first.router.push('/recipes')
    expect(first.hardNavigate).toHaveBeenCalledTimes(1)

    // Po načítaní sa nová verzia znova hlási pripravená (napr. ďalšie vydanie) – do 15 s sa už neobnovuje.
    time += 5_000
    const second = await load(storage, () => time)
    second.updates.markReady()
    await second.router.push('/recipes')
    expect(second.hardNavigate).not.toHaveBeenCalled()
    expect(second.router.currentRoute.value.path).toBe('/recipes')

    time += 15_000
    const third = await load(storage, () => time)
    third.updates.markReady()
    await third.router.push('/recipes')
    expect(third.hardNavigate).toHaveBeenCalledTimes(1)
  })

  it('chýbajúci súbor stránky po znovunačítaní neobnovuje dokola', async () => {
    const storage = memoryStorage()
    const time = 2_000_000
    const first = await load(storage, () => time)
    await first.router.push('/shopping').catch(() => {})
    expect(first.hardNavigate).toHaveBeenCalledTimes(1)

    const second = await load(storage, () => time + 1_000)
    await second.router.push('/shopping').catch(() => {})
    expect(second.hardNavigate).not.toHaveBeenCalled()
  })
})
