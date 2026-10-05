import { computed, ref, watchEffect, type Ref } from 'vue'
import { useTheme } from 'vuetify'

export type ThemePreference = 'light' | 'dark' | 'system'

const KEY = 'kniha:theme'

export const parseThemePreference = (raw: string | null | undefined): ThemePreference =>
  raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system'

export const resolveTheme = (preference: ThemePreference, systemDark: boolean): 'light' | 'dark' =>
  preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

function readStored(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(KEY))
  } catch {
    return 'system'
  }
}

// Spoločný stav pre prepínač v hlavičke aj v nastaveniach.
const preference = ref<ThemePreference>(readStored())
const systemDark = ref(
  typeof matchMedia === 'undefined' ? false : matchMedia('(prefers-color-scheme: dark)').matches,
)

if (typeof matchMedia !== 'undefined') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    systemDark.value = e.matches
  })
}

const ORDER: ThemePreference[] = ['system', 'light', 'dark']

export function useThemePreference() {
  const resolved = computed(() => resolveTheme(preference.value, systemDark.value))

  function set(value: ThemePreference) {
    preference.value = value
    try {
      localStorage.setItem(KEY, value)
    } catch {
      // súkromné okno a pod.
    }
  }

  return {
    preference,
    resolved,
    set,
    /** Prepne systém → svetlá → tmavá → systém. */
    cycle: () => set(ORDER[(ORDER.indexOf(preference.value) + 1) % ORDER.length]!),
  }
}

/** Raz v koreni aplikácie: premietne zvolenú tému do Vuetify. */
/** `forceLight`: počas tlače sa použije svetlá téma bez ohľadu na voľbu (inak by svetlý text zmizol na papieri). */
export function useApplyTheme(forceLight?: Ref<boolean>) {
  const theme = useTheme()
  const { resolved } = useThemePreference()
  watchEffect(() => theme.change(forceLight?.value ? 'light' : resolved.value))
}
