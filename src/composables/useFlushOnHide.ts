import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Zavolá `flush`, keď sa stránka zatvára, obnovuje alebo skrýva (prepnutie karty, zamknutie telefónu).
 * Slúži na okamžité uloženie rozpísaného konceptu, namiesto okna prehliadača „Naozaj odísť?“, ktoré sa nedá upraviť.
 */
export function useFlushOnHide(flush: () => void) {
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  onMounted(() => {
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('pagehide', flush)
    document.removeEventListener('visibilitychange', onVisibility)
  })
}
