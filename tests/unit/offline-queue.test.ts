import { describe, expect, it, vi } from 'vitest'
import {
  applyPending,
  createOfflineQueue,
  syncPending,
  type QueuedChange,
  type QueueStorage,
} from '@/features/shopping/offlineQueue'

function memoryStorage(initial: QueuedChange[] = []): QueueStorage & { data: QueuedChange[] } {
  const store = {
    data: [...initial],
    get: async () => [...store.data],
    set: async (changes: QueuedChange[]) => {
      store.data = [...changes]
    },
  }
  return store
}

const change = (id: string, isChecked: boolean, at: string): QueuedChange => ({ id, isChecked, at })

describe('offline fronta odškrtnutí', () => {
  it('pre rovnakú položku si nechá len najnovšiu zmenu', async () => {
    const storage = memoryStorage()
    const queue = createOfflineQueue(storage, vi.fn())
    await queue.enqueue(change('a', true, '2026-10-05T10:00:00.000Z'))
    await queue.enqueue(change('b', true, '2026-10-05T10:00:01.000Z'))
    await queue.enqueue(change('a', false, '2026-10-05T10:00:02.000Z'))
    expect(storage.data).toEqual([
      change('b', true, '2026-10-05T10:00:01.000Z'),
      change('a', false, '2026-10-05T10:00:02.000Z'),
    ])
    expect(await queue.size()).toBe(2)
  })

  it('odošle všetko naraz a frontu vyprázdni', async () => {
    const storage = memoryStorage([change('a', true, '2026-10-05T10:00:00.000Z')])
    const send = vi.fn().mockResolvedValue(undefined)
    const queue = createOfflineQueue(storage, send)
    expect(await queue.flush()).toBe(1)
    expect(send).toHaveBeenCalledWith([change('a', true, '2026-10-05T10:00:00.000Z')])
    expect(storage.data).toEqual([])
    expect(await queue.flush()).toBe(0)
    expect(send).toHaveBeenCalledOnce()
  })

  it('pri neúspechu zmeny ponechá', async () => {
    const storage = memoryStorage([change('a', true, '2026-10-05T10:00:00.000Z')])
    const queue = createOfflineQueue(storage, vi.fn().mockRejectedValue(new Error('offline')))
    await expect(queue.flush()).rejects.toThrow('offline')
    expect(storage.data).toHaveLength(1)
  })

  it('zmena pridaná počas odosielania sa nestratí', async () => {
    const storage = memoryStorage([change('a', true, '2026-10-05T10:00:00.000Z')])
    let release!: () => void
    const send = vi.fn(() => new Promise<void>((resolve) => (release = resolve)))
    const queue = createOfflineQueue(storage, send)
    const flushing = queue.flush()
    await Promise.resolve()
    await queue.enqueue(change('a', false, '2026-10-05T10:00:05.000Z'))
    await queue.enqueue(change('b', true, '2026-10-05T10:00:06.000Z'))
    release()
    await flushing
    expect(storage.data).toEqual([
      change('a', false, '2026-10-05T10:00:05.000Z'),
      change('b', true, '2026-10-05T10:00:06.000Z'),
    ])
  })
})

describe('applyPending', () => {
  it('čakajúce odškrtnutia prekryjú stav zo servera, kým sa neodošlú', () => {
    const items = [
      { id: 'a', isChecked: false, checkedAt: null },
      { id: 'b', isChecked: true, checkedAt: '2026-10-05T09:00:00.000Z' },
      { id: 'c', isChecked: false, checkedAt: null },
    ]
    const result = applyPending(items, [
      change('a', true, '2026-10-05T10:00:00.000Z'),
      change('b', false, '2026-10-05T10:00:01.000Z'),
      change('zmazana', true, '2026-10-05T10:00:02.000Z'),
    ])
    expect(result).toEqual([
      { id: 'a', isChecked: true, checkedAt: '2026-10-05T10:00:00.000Z' },
      { id: 'b', isChecked: false, checkedAt: null },
      { id: 'c', isChecked: false, checkedAt: null },
    ])
  })
})

describe('súbežné zápisy do fronty', () => {
  it('dve zmeny naraz sa obe uložia', async () => {
    const storage = memoryStorage()
    const queue = createOfflineQueue(storage, vi.fn())
    await Promise.all([
      queue.enqueue(change('a', true, '2026-10-05T10:00:00.000Z')),
      queue.enqueue(change('b', true, '2026-10-05T10:00:01.000Z')),
    ])
    expect(storage.data.map((c) => c.id).sort()).toEqual(['a', 'b'])
  })

  it('zmena pridaná súbežne s koncom odosielania sa nestratí', async () => {
    const storage = memoryStorage([change('a', true, '2026-10-05T10:00:00.000Z')])
    const queue = createOfflineQueue(storage, vi.fn().mockResolvedValue(undefined))
    await Promise.all([queue.flush(), queue.enqueue(change('b', true, '2026-10-05T10:00:05.000Z'))])
    expect(storage.data).toEqual([change('b', true, '2026-10-05T10:00:05.000Z')])
  })
})

describe('syncPending', () => {
  it('po úspešnom načítaní odošle čakajúce zmeny a načíta znova', async () => {
    const storage = memoryStorage([change('a', true, '2026-10-05T10:00:00.000Z')])
    const send = vi.fn().mockResolvedValue(undefined)
    const queue = createOfflineQueue(storage, send)
    const fetchItems = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'a', isChecked: false, checkedAt: null }])
      .mockResolvedValueOnce([{ id: 'a', isChecked: true, checkedAt: 'x' }])
    const items = await syncPending(fetchItems, queue)
    expect(send).toHaveBeenCalledOnce()
    expect(fetchItems).toHaveBeenCalledTimes(2)
    expect(items).toEqual([{ id: 'a', isChecked: true, checkedAt: 'x' }])
  })

  it('keď odoslanie zlyhá, prekryje načítané položky čakajúcimi zmenami', async () => {
    const storage = memoryStorage([change('a', true, '2026-10-05T10:00:00.000Z')])
    const queue = createOfflineQueue(storage, vi.fn().mockRejectedValue(new Error('offline')))
    const fetchItems = vi.fn().mockResolvedValue([{ id: 'a', isChecked: false, checkedAt: null }])
    const items = await syncPending(fetchItems, queue)
    expect(fetchItems).toHaveBeenCalledOnce()
    expect(items).toEqual([{ id: 'a', isChecked: true, checkedAt: '2026-10-05T10:00:00.000Z' }])
  })
})
