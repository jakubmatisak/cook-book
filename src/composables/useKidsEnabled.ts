import { computed } from 'vue'
import { useMe } from '@/api/me'

/** Detské recepty zapnuté v nastaveniach človeka (predvolene áno; kým sa nastavenia nenačítajú, nie). */
export function useKidsEnabled() {
  const { data: me } = useMe()
  return computed(() => me.value !== undefined && me.value.userSettings.kidsEnabled !== false)
}
