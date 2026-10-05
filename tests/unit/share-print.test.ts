import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { canShare, copyText, shareText } from '@/composables/useShare'
import { createPrintState } from '@/composables/usePrintMode'

describe('copyText', () => {
  it('zapíše text do schránky', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    expect(await copyText('Ahoj', { clipboard: { writeText } })).toBe(true)
    expect(writeText).toHaveBeenCalledWith('Ahoj')
  })

  it('bez schránky alebo pri odmietnutí vráti false, nie chybu', async () => {
    expect(await copyText('x', {})).toBe(false)
    const denied = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
    expect(await copyText('x', { clipboard: { writeText: denied } })).toBe(false)
  })
})

describe('shareText', () => {
  it('zdieľa cez systémové okno', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    expect(canShare({ share })).toBe(true)
    expect(await shareText({ title: 'Guláš', text: '# Guláš' }, { share })).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'Guláš', text: '# Guláš' })
  })

  it('zrušenie používateľom nie je chyba', async () => {
    const abort = Object.assign(new Error('zrušené'), { name: 'AbortError' })
    expect(await shareText({ title: 'a', text: 'b' }, { share: vi.fn().mockRejectedValue(abort) })).toBe(
      'cancelled',
    )
  })

  it('bez podpory vráti unsupported a iná chyba sa prepošle', async () => {
    expect(canShare({})).toBe(false)
    expect(await shareText({ title: 'a', text: 'b' }, {})).toBe('unsupported')
    const broken = vi.fn().mockRejectedValue(new Error('zlyhalo'))
    await expect(shareText({ title: 'a', text: 'b' }, { share: broken })).rejects.toThrow('zlyhalo')
  })
})

function fakeWindow(initialMatch = false) {
  const listeners = new Map<string, Set<() => void>>()
  const mediaListeners = new Set<(e: { matches: boolean }) => void>()
  return {
    win: {
      addEventListener: (type: string, fn: () => void) => {
        listeners.set(type, (listeners.get(type) ?? new Set()).add(fn))
      },
      removeEventListener: (type: string, fn: () => void) => void listeners.get(type)?.delete(fn),
      matchMedia: () => ({
        matches: initialMatch,
        addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => void mediaListeners.add(fn),
        removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) =>
          void mediaListeners.delete(fn),
      }),
    },
    fire: (type: string) => listeners.get(type)?.forEach((fn) => fn()),
    media: (matches: boolean) => mediaListeners.forEach((fn) => fn({ matches })),
    listenerCount: () => [...listeners.values()].reduce((n, s) => n + s.size, 0) + mediaListeners.size,
  }
}

describe('createPrintState', () => {
  it('zapne tlačový režim pred tlačou a vypne po nej', () => {
    const w = fakeWindow()
    const { printing } = createPrintState(w.win)
    expect(printing.value).toBe(false)
    w.fire('beforeprint')
    expect(printing.value).toBe(true)
    w.fire('afterprint')
    expect(printing.value).toBe(false)
  })

  it('sleduje aj tlačové médium a začne so správnym stavom', () => {
    const w = fakeWindow(true)
    const { printing } = createPrintState(w.win)
    expect(printing.value).toBe(true)
    w.media(false)
    expect(printing.value).toBe(false)
    w.media(true)
    expect(printing.value).toBe(true)
  })

  it('stop odstráni všetkých poslucháčov a scope ich odstráni sám', () => {
    const w = fakeWindow()
    const state = createPrintState(w.win)
    expect(w.listenerCount()).toBe(3)
    state.stop()
    expect(w.listenerCount()).toBe(0)

    const scope = effectScope()
    const w2 = fakeWindow()
    scope.run(() => createPrintState(w2.win, true))
    expect(w2.listenerCount()).toBe(3)
    scope.stop()
    expect(w2.listenerCount()).toBe(0)
  })

  it('bez window alebo matchMedia nepadne', () => {
    expect(createPrintState(undefined).printing.value).toBe(false)
    const { printing } = createPrintState({ addEventListener: () => {}, removeEventListener: () => {} })
    expect(printing.value).toBe(false)
  })
})
