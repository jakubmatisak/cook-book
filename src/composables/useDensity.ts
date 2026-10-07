import { computed, type ComputedRef } from 'vue'
import { useDisplay } from 'vuetify'
import type { Density } from '@shared/userSettings'
import { useMe } from '@/api/me'

/** Hustota rozhrania: na mobile vždy kompaktná, na počítači podľa nastavenia človeka (predvolene pohodlná). */
export function useDensity(): ComputedRef<Density> {
  const { smAndDown } = useDisplay()
  const { data: me } = useMe()
  return computed(() => (smAndDown.value ? 'compact' : (me.value?.userSettings.density ?? 'comfortable')))
}
