import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDraftStore } from '@/composables/useDraft'

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

afterEach(() => vi.useRealTimers())

describe('createDraftStore', () => {
  it('uloží rozpísaný obsah až po pauze v písaní', () => {
    vi.useFakeTimers()
    const storage = fakeStorage()
    const store = createDraftStore<{ title: string }>('recipe:new', { storage, debounceMs: 500 })
    store.save({ title: 'G' })
    store.save({ title: 'Gu' })
    expect(storage.data.size).toBe(0)
    vi.advanceTimersByTime(500)
    expect(store.load()).toEqual({ title: 'Gu' })
  })

  it('vráti null, keď nič nie je uložené alebo je obsah poškodený', () => {
    const storage = fakeStorage()
    const store = createDraftStore('recipe:x', { storage, debounceMs: 0 })
    expect(store.load()).toBeNull()
    storage.setItem('kniha:draft:recipe:x', '{nie json')
    expect(store.load()).toBeNull()
  })

  it('clear zmaže uložený aj čakajúci obsah', () => {
    vi.useFakeTimers()
    const storage = fakeStorage()
    const store = createDraftStore<{ title: string }>('recipe:new', { storage, debounceMs: 500 })
    store.save({ title: 'A' })
    vi.advanceTimersByTime(500)
    store.save({ title: 'B' })
    store.clear()
    vi.advanceTimersByTime(500)
    expect(store.load()).toBeNull()
  })

  it('nespadne, keď úložisko nie je dostupné', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    const store = createDraftStore('recipe:new', { storage: broken, debounceMs: 0 })
    expect(() => store.save({})).not.toThrow()
    expect(store.load()).toBeNull()
    expect(() => store.clear()).not.toThrow()
  })
})
