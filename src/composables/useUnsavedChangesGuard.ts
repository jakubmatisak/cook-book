import { onBeforeUnmount, onMounted, toValue, type MaybeRefOrGetter } from 'vue'

/**
 * Pri neuložených zmenách požiada prehliadač o potvrdenie pred obnovením alebo zatvorením stránky
 * (napr. potiahnutie na obnovenie na mobile). Navigáciu v aplikácii rieši `onBeforeRouteLeave`.
 */
export function useUnsavedChangesGuard(dirty: MaybeRefOrGetter<boolean>) {
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!toValue(dirty)) return
    event.preventDefault()
    event.returnValue = ''
  }
  onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
}
