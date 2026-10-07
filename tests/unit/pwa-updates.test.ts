import { describe, expect, it, vi } from 'vitest'
import { watchForUpdates } from '@/lib/pwaUpdates'

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
