import { get, set } from 'idb-keyval'
import { activeHouseholdId } from '@/lib/household'

export interface QueuedChange {
  id: string
  isChecked: boolean
  /** Čas zmeny na zariadení (ISO); server použije len zmenu novšiu ako posledná úprava. */
  at: string
}

export interface QueueStorage {
  get(): Promise<QueuedChange[]>
  set(changes: QueuedChange[]): Promise<void>
}

const KEY = 'kniha:shopping-queue'

/** Každá domácnosť má vlastnú frontu, aby sa odškrtnutie nikdy neodoslalo do inej domácnosti. */
export const queueKey = (householdId: string | null): string => (householdId ? `${KEY}:${householdId}` : KEY)

/** Fronta v IndexedDB pre aktuálne zvolenú domácnosť (kľúč sa určuje pri každej operácii). */
export const idbQueueStorage: QueueStorage = {
  get: async () => (await get<QueuedChange[]>(queueKey(activeHouseholdId()))) ?? [],
  set: (changes) => set(queueKey(activeHouseholdId()), changes),
}

/** Fronta odškrtnutí urobených bez signálu; odošle sa hromadne po pripojení. */
export function createOfflineQueue(
  storage: QueueStorage,
  send: (changes: QueuedChange[]) => Promise<unknown>,
) {
  // Všetky operácie nad úložiskom idú za sebou, inak by si dve súbežné zmeny prepísali zápis.
  let lock: Promise<unknown> = Promise.resolve()
  const serialized = <T>(op: () => Promise<T>): Promise<T> => {
    const next = lock.then(op, op)
    lock = next.catch(() => undefined)
    return next
  }

  const enqueue = (change: QueuedChange) =>
    serialized(async () => {
      const current = await storage.get()
      await storage.set([...current.filter((c) => c.id !== change.id), change])
    })

  /** Odošle všetko; zmeny pridané počas odosielania ostanú vo fronte. Vráti počet odoslaných. */
  async function flush(): Promise<number> {
    const pending = await serialized(() => storage.get())
    if (pending.length === 0) return 0
    await send(pending)
    const sent = new Map(pending.map((c) => [c.id, c.at]))
    await serialized(async () => {
      const after = await storage.get()
      await storage.set(after.filter((c) => sent.get(c.id) !== c.at))
    })
    return pending.length
  }

  const pending = () => serialized(() => storage.get())
  const size = async () => (await pending()).length

  return { enqueue, flush, size, pending }
}

export type OfflineQueue = ReturnType<typeof createOfflineQueue>

/** Prekryje stav položiek zo servera čakajúcimi (ešte neodoslanými) odškrtnutiami. */
export function applyPending<T extends { id: string; isChecked: boolean; checkedAt: string | null }>(
  items: readonly T[],
  pending: readonly QueuedChange[],
): T[] {
  if (pending.length === 0) return [...items]
  const byId = new Map(pending.map((c) => [c.id, c]))
  return items.map((item) => {
    const change = byId.get(item.id)
    return change
      ? { ...item, isChecked: change.isChecked, checkedAt: change.isChecked ? change.at : null }
      : item
  })
}

/**
 * Načíta položky a ak sú vo fronte čakajúce zmeny, skúsi ich hneď odoslať (spojenie zjavne funguje)
 * a načíta znova. Keď odoslanie zlyhá, čakajúce zmeny sa aspoň prekryjú cez načítaný stav.
 */
export async function syncPending<T extends { id: string; isChecked: boolean; checkedAt: string | null }>(
  fetchItems: () => Promise<T[]>,
  queue: OfflineQueue,
): Promise<T[]> {
  let items = await fetchItems()
  if ((await queue.size()) > 0) {
    try {
      if ((await queue.flush()) > 0) items = await fetchItems()
    } catch {
      // bez spojenia – fronta ostáva
    }
  }
  return applyPending(items, await queue.pending())
}
