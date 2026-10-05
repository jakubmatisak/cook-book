import { describe, expect, it, vi } from 'vitest'
import { createWakeLock } from '@/composables/useWakeLock'

function setup(supported = true) {
  const listeners = new Map<string, () => void>()
  const sentinel = { release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn() }
  const request = vi.fn().mockResolvedValue(sentinel)
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (type: string, fn: () => void) => void listeners.set(type, fn),
    removeEventListener: (type: string) => void listeners.delete(type),
  }
  const lock = createWakeLock(supported ? { wakeLock: { request } } : {}, doc)
  return { lock, request, sentinel, doc, listeners }
}

describe('createWakeLock', () => {
  it('zapne držanie obrazovky a vypne ho', async () => {
    const { lock, request, sentinel, listeners } = setup()
    expect(lock.supported).toBe(true)
    await lock.enable()
    expect(request).toHaveBeenCalledWith('screen')
    expect(listeners.has('visibilitychange')).toBe(true)
    await lock.disable()
    expect(sentinel.release).toHaveBeenCalledOnce()
    expect(listeners.has('visibilitychange')).toBe(false)
  })

  it('po návrate do aplikácie ho znova požiada, lebo prehliadač ho pri skrytí uvoľní', async () => {
    const { lock, request, listeners } = setup()
    await lock.enable()
    listeners.get('visibilitychange')!()
    await Promise.resolve()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('bez podpory prehliadača nespadne', async () => {
    const { lock } = setup(false)
    expect(lock.supported).toBe(false)
    await expect(lock.enable()).resolves.toBeUndefined()
    await expect(lock.disable()).resolves.toBeUndefined()
  })

  it('zamietnutie požiadavky (napr. šetrenie batérie) neprepadne ako chyba', async () => {
    const { lock, request } = setup()
    request.mockRejectedValueOnce(new Error('NotAllowedError'))
    await expect(lock.enable()).resolves.toBeUndefined()
  })
})
