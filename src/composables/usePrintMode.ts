import { onScopeDispose, ref, type Ref } from 'vue'

interface MediaQueryLike {
  matches: boolean
  addEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void
  removeEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void
}

interface PrintWindow {
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
  matchMedia?: (query: string) => MediaQueryLike
}

/**
 * Či sa stránka práve tlačí. Prehliadač oznámi tlač udalosťou `beforeprint` (a tlačovým médiom pri
 * „uložiť ako PDF“), pred samotným vykreslením tlače sa teda stihne prepnúť svetlá téma a skryť menu.
 */
export function createPrintState(
  win: PrintWindow | undefined = typeof window === 'undefined' ? undefined : window,
  autoStop = false,
): { printing: Ref<boolean>; stop: () => void } {
  const printing = ref(false)
  if (!win) return { printing, stop: () => {} }

  const on = () => {
    printing.value = true
  }
  const off = () => {
    printing.value = false
  }
  const media = win.matchMedia?.('print')
  const onMedia = (event: { matches: boolean }) => {
    printing.value = event.matches
  }
  printing.value = media?.matches ?? false

  win.addEventListener('beforeprint', on)
  win.addEventListener('afterprint', off)
  media?.addEventListener('change', onMedia)

  const stop = () => {
    win.removeEventListener('beforeprint', on)
    win.removeEventListener('afterprint', off)
    media?.removeEventListener('change', onMedia)
  }
  if (autoStop) onScopeDispose(stop)
  return { printing, stop }
}

/** Pre komponenty: sleduje tlač a po zániku komponentu po sebe upratá. */
export const usePrintMode = (): Ref<boolean> => createPrintState(undefined, true).printing
