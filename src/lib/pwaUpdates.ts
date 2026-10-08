interface UpdatableRegistration {
  update(): Promise<unknown>
}

interface VisibilityDocument {
  visibilityState: DocumentVisibilityState
  addEventListener(type: 'visibilitychange', listener: () => void): void
}

/**
 * Nová verzia aplikácie sa hľadá pri spustení (registerSW s `immediate`) a vždy, keď sa človek do aplikácie vráti
 * (nainštalovaná PWA na mobile beží dni bez zatvorenia). Keď sa nájde, service worker ju nainštaluje a aplikácia
 * sa sama načíta znova. Počas práce sa nekontroluje, aby sa stránka neprenačítala uprostred písania.
 */
export function watchForUpdates(
  registration: UpdatableRegistration,
  doc: VisibilityDocument = document,
): void {
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState !== 'visible') return
    // Bez signálu kontrola zlyhá; skúsi sa pri ďalšom návrate.
    registration.update().catch(() => {})
  })
}

interface NavigationRouter {
  beforeEach(guard: (to: { fullPath: string }) => boolean | void): unknown
  onError(handler: (error: unknown, to: { fullPath: string }) => void): unknown
}

/** Súbor stránky (lazy chunk) sa nepodarilo stiahnuť – po vydaní novej verzie už na serveri nie je. */
const isChunkLoadError = (error: unknown) =>
  error instanceof Error &&
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    error.message,
  )

export interface ReloadGuard {
  storage: Pick<Storage, 'getItem' | 'setItem'>
  now: () => number
}

const RELOAD_GUARD_KEY = 'kniha:hard-reload-at'
const RELOAD_GUARD_MS = 15_000

const sessionGuard = (): ReloadGuard => ({ storage: window.sessionStorage, now: () => Date.now() })

/**
 * Nová verzia sa nenačíta uprostred ťukania (klik by sa stratil), ale pri najbližšom prechode na inú stránku:
 * cieľ sa otvorí celý znova už v novej verzii. Rovnako, keď stará stránka žiada súbor, ktorý po vydaní na
 * serveri už nie je – namiesto zaseknutia sa cieľ načíta celý.
 *
 * Poistka: celá stránka sa takto načíta najviac raz za 15 s. Keby sa po načítaní stav opakoval (napr. service
 * worker ešte podáva starú verziu), aplikácia sa neobnovuje dokola – prechod ostane v nej.
 */
export function reloadOnNavigation(
  router: NavigationRouter,
  hardNavigate: (path: string) => void = (path) => window.location.assign(path),
  guard: ReloadGuard = sessionGuard(),
): { markReady: () => void } {
  let ready = false
  /** Načíta cieľ celý znova, ak sa to nestalo pred chvíľou; vráti, či sa tak stalo. */
  const reload = (path: string): boolean => {
    try {
      const last = Number(guard.storage.getItem(RELOAD_GUARD_KEY) ?? 0)
      if (guard.now() - last < RELOAD_GUARD_MS) return false
      guard.storage.setItem(RELOAD_GUARD_KEY, String(guard.now()))
    } catch {
      // úložisko nie je dostupné – načíta sa bez poistky
    }
    hardNavigate(path)
    return true
  }
  router.beforeEach((to) => {
    if (!ready) return
    ready = false
    if (reload(to.fullPath)) return false
  })
  router.onError((error, to) => {
    if (isChunkLoadError(error)) reload(to.fullPath)
  })
  return { markReady: () => (ready = true) }
}
