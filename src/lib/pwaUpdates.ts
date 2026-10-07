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
