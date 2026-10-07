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

const CONTROL_HEIGHTS: Readonly<Record<Density, number>> = { compact: 40, comfortable: 48, default: 56 }

/**
 * Výška poľa (v-text-field, v-select) pri aktuálnej hustote. Tlačidlá a prepínače v riadku s poľami ju používajú,
 * aby boli rovnako vysoké.
 */
export function useControlHeight(): ComputedRef<number> {
  const density = useDensity()
  return computed(() => CONTROL_HEIGHTS[density.value])
}
