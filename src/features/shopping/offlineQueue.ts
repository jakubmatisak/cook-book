import { get, set } from 'idb-keyval'

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

export const idbQueueStorage: QueueStorage = {
  get: async () => (await get<QueuedChange[]>(KEY)) ?? [],
  set: (changes) => set(KEY, changes),
}

/** Fronta odškrtnutí urobených bez signálu; odošle sa hromadne po pripojení. */
export function createOfflineQueue(
  storage: QueueStorage,
  send: (changes: QueuedChange[]) => Promise<unknown>,
) {
  async function enqueue(change: QueuedChange) {
    const current = await storage.get()
    await storage.set([...current.filter((c) => c.id !== change.id), change])
  }

  /** Odošle všetko; zmeny pridané počas odosielania ostanú vo fronte. Vráti počet odoslaných. */
  async function flush(): Promise<number> {
    const pending = await storage.get()
    if (pending.length === 0) return 0
    await send(pending)
    const after = await storage.get()
    const sent = new Map(pending.map((c) => [c.id, c.at]))
    await storage.set(after.filter((c) => sent.get(c.id) !== c.at))
    return pending.length
  }

  const size = async () => (await storage.get()).length

  return { enqueue, flush, size }
}
