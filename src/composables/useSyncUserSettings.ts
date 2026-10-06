import { ref, watch } from 'vue'
import { useMe } from '@/api/me'
import { useSaveUserSettings } from '@/api/userSettings'
import { currentLocale, i18n, setLocale } from '@/i18n'
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
      // Jazyk: rovnako ako vzhľad (server má prednosť, jazyk zvolený na zariadení sa prenesie na server)
      if (settings.locale && settings.locale !== currentLocale()) setLocale(settings.locale)
      else if (!settings.locale && currentLocale() !== 'sk') save.mutate({ locale: currentLocale() })
      synced.value = true
    },
    { immediate: true },
  )

  watch(i18n.global.locale, () => {
    if (!synced.value) return
    if (currentLocale() !== (me.value?.userSettings.locale ?? 'sk')) save.mutate({ locale: currentLocale() })
  })

  watch(preference, (value) => {
    if (!synced.value) return
    if (value !== (me.value?.userSettings.theme ?? 'system')) save.mutate({ theme: value })
  })
}
