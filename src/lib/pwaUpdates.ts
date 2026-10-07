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

/**
 * Nová verzia sa nenačíta uprostred ťukania (klik by sa stratil), ale pri najbližšom prechode na inú stránku:
 * cieľ sa otvorí celý znova už v novej verzii. Rovnako, keď stará stránka žiada súbor, ktorý po vydaní na
 * serveri už nie je – namiesto zaseknutia sa cieľ načíta celý.
 */
export function reloadOnNavigation(
  router: NavigationRouter,
  hardNavigate: (path: string) => void = (path) => window.location.assign(path),
): { markReady: () => void } {
  let ready = false
  router.beforeEach((to) => {
    if (!ready) return
    hardNavigate(to.fullPath)
    return false
  })
  router.onError((error, to) => {
    if (isChunkLoadError(error)) hardNavigate(to.fullPath)
  })
  return { markReady: () => (ready = true) }
}
