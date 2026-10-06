import { ref, watch } from 'vue'
import { useMe } from '@/api/me'
import { useSaveUserSettings } from '@/api/userSettings'
import { useThemePreference } from './useThemePreference'

/**
 * Raz v koreni aplikácie (po zvolení domácnosti): zosúladí nastavenia človeka so serverom.
 * Server → zariadenie: po načítaní sa prevezme uložený vzhľad. Zariadenie → server: zmena sa uloží.
 * Vzhľad zvolený na zariadení pred prvým uložením sa na server prenesie.
 */
export function useSyncUserSettings() {
  const { data: me } = useMe()
  const save = useSaveUserSettings()
  const { preference, set } = useThemePreference()
  const synced = ref(false)

  watch(
    () => me.value?.userSettings,
    (settings) => {
      if (!settings || synced.value) return
      if (settings.theme && settings.theme !== preference.value) set(settings.theme)
      else if (!settings.theme && preference.value !== 'system') save.mutate({ theme: preference.value })
      synced.value = true
    },
    { immediate: true },
  )

  watch(preference, (value) => {
    if (!synced.value) return
    if (value !== (me.value?.userSettings.theme ?? 'system')) save.mutate({ theme: value })
  })
}
