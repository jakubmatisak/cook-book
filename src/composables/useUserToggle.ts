import { computed, ref, type WritableComputedRef } from 'vue'
import { useMe } from '@/api/me'
import { useSaveUserSettings } from '@/api/userSettings'

type ToggleKey = 'shoppingCartOpen' | 'planSuggestionsOpen'

/**
 * Rozbalenie sekcie uložené v nastaveniach človeka (platí na všetkých zariadeniach). Predvolene je rozbalená,
 * preto sa rozbalenie ukladá ako `null` (vymazanie) a zbalenie ako `false`. Zmena sa prejaví hneď, ešte pred
 * odpoveďou servera.
 */
export function useUserToggle(key: ToggleKey): WritableComputedRef<boolean> {
  const { data: me } = useMe()
  const save = useSaveUserSettings()
  const pending = ref<boolean | null>(null)
  return computed({
    get: () => pending.value ?? me.value?.userSettings[key] !== false,
    set: (value: boolean) => {
      pending.value = value
      save.mutate({ [key]: value ? null : false }, { onSettled: () => (pending.value = null) })
    },
  })
}
