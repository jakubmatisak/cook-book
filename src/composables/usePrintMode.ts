import { computed, nextTick, onScopeDispose, ref, type Ref } from 'vue'

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

/**
 * Tlač z tlačidla: `window.print()` volané priamo z kliknutia by prehliadač spustil skôr, než Vue stihne
 * prepnúť svetlú tému a odstrániť lišty (zmena DOM čaká na koniec obsluhy). Preto sa najprv zapne
 * tlačový režim, počká sa na vykreslenie a až potom sa tlačí.
 */
export function createPrinter(win: PrintWindow & { print(): void }, settle: () => Promise<void>) {
  const forced = ref(false)
  let safety: ReturnType<typeof setTimeout> | undefined
  const release = () => {
    clearTimeout(safety)
    forced.value = false
  }
  win.addEventListener('afterprint', release)
  return {
    forced,
    async print() {
      forced.value = true
      // Poistka: keby prehliadač koniec tlače neoznámil, stránka sa sama vráti do bežného vzhľadu.
      safety = setTimeout(release, 60_000)
      await settle()
      win.print()
    },
  }
}

const afterRender = async () => {
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

let shared: ReturnType<typeof createPrinter> | undefined
const printer = () => (shared ??= createPrinter(window, afterRender))

/** Vytlačí aktuálnu stránku v tlačovom režime (svetlá téma, bez líšt). */
export const printPage = (): Promise<void> => printer().print()

/** Pre komponenty: sleduje tlač a po zániku komponentu po sebe upratá. */
export const usePrintMode = (): Ref<boolean> => {
  const { printing } = createPrintState(undefined, true)
  return computed(() => printing.value || printer().forced.value)
}
