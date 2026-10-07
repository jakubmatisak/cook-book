import { ref, type Ref } from 'vue'
import type { Router } from 'vue-router'

/** Spoločný stav pre pruh načítania v hornej lište (nastavuje ho router aplikácie). */
export const navigationPending = ref(false)

/**
 * Sleduje, či práve prebieha prechod na inú stránku (sťahuje sa jej kód). Zobrazuje sa ako tenký pruh pod hornou
 * lištou, aby bolo vidno, že klik zabral.
 */
export function trackNavigation(router: Router, pending: Ref<boolean> = ref(false)): Ref<boolean> {
  router.beforeEach(() => {
    pending.value = true
  })
  router.afterEach(() => {
    pending.value = false
  })
  router.onError(() => {
    pending.value = false
  })
  return pending
}
