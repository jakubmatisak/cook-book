import { onBeforeUnmount, ref } from 'vue'

interface WakeLockSentinelLike {
  release(): Promise<void>
}

interface WakeLockNavigator {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> }
}

interface VisibilityDocument {
  visibilityState: DocumentVisibilityState
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

/**
 * Drží obrazovku zapnutú (Wake Lock API). Prehliadač zámok pri skrytí stránky uvoľní,
 * preto sa po návrate požiada znova. Bez podpory alebo pri odmietnutí sa ticho nič nedeje.
 */
export function createWakeLock(nav: WakeLockNavigator, doc: VisibilityDocument) {
  let sentinel: WakeLockSentinelLike | null = null
  let wanted = false
  const supported = Boolean(nav.wakeLock)

  async function acquire() {
    if (!supported || !wanted) return
    try {
      sentinel = (await nav.wakeLock?.request('screen')) ?? null
    } catch {
      sentinel = null
    }
  }

  const onVisibility = () => {
    if (doc.visibilityState === 'visible') void acquire()
  }

  return {
    supported,
    async enable() {
      if (!supported) return
      wanted = true
      doc.addEventListener('visibilitychange', onVisibility)
      await acquire()
    },
    async disable() {
      wanted = false
      doc.removeEventListener('visibilitychange', onVisibility)
      const current = sentinel
      sentinel = null
      try {
        await current?.release()
      } catch {
        // už uvoľnený
      }
    },
  }
}

/** Zapne držanie obrazovky, kým je komponent zobrazený. */
export function useWakeLock() {
  const lock = createWakeLock(navigator as WakeLockNavigator, document)
  const supported = ref(lock.supported)
  void lock.enable()
  onBeforeUnmount(() => void lock.disable())
  return { supported }
}
