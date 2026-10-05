export interface DraftStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface DraftStore<T> {
  /** Uloží koncept po pauze v písaní (debounce). */
  save(value: T): void
  load(): T | null
  clear(): void
}

const PREFIX = 'kniha:draft:'

/**
 * Koncept rozpísaného formulára v úložisku prehliadača. Chráni pred stratou práce pri obnovení stránky
 * (aj na iPhone, kde `beforeunload` nefunguje). Chyby úložiska sa ticho ignorujú.
 */
export function createDraftStore<T>(
  key: string,
  options: { storage?: DraftStorage; debounceMs?: number } = {},
): DraftStore<T> {
  const fullKey = PREFIX + key
  const debounceMs = options.debounceMs ?? 500
  const storage = options.storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
  let timer: ReturnType<typeof setTimeout> | undefined

  const safely = <R>(fn: () => R, fallback: R): R => {
    try {
      return fn()
    } catch {
      return fallback
    }
  }

  return {
    save(value) {
      clearTimeout(timer)
      timer = setTimeout(() => {
        safely(() => storage?.setItem(fullKey, JSON.stringify(value)), undefined)
      }, debounceMs)
    },
    load() {
      const raw = safely(() => storage?.getItem(fullKey) ?? null, null)
      if (!raw) return null
      return safely(() => JSON.parse(raw) as T, null)
    },
    clear() {
      clearTimeout(timer)
      safely(() => storage?.removeItem(fullKey), undefined)
    },
  }
}
