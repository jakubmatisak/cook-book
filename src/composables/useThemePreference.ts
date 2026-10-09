import { computed, ref, watchEffect, type Ref } from 'vue'
import { useTheme } from 'vuetify'
import { COLOR_SCHEMES, DEFAULT_COLOR_SCHEME, type ColorScheme } from '@shared/userSettings'
import { schemes } from '@/design/tokens'

export type ThemePreference = 'light' | 'dark' | 'system'

const KEY = 'kniha:theme'
const SCHEME_KEY = 'kniha:color-scheme'

export const parseColorScheme = (raw: string | null | undefined): ColorScheme =>
  (COLOR_SCHEMES as readonly string[]).includes(raw ?? '') ? (raw as ColorScheme) : DEFAULT_COLOR_SCHEME

/** Názov Vuetify témy: farebná schéma a svetlý či tmavý režim. */
export const themeName = (scheme: ColorScheme, mode: 'light' | 'dark') => `${scheme}-${mode}`

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

function readStoredScheme(): ColorScheme {
  try {
    return parseColorScheme(localStorage.getItem(SCHEME_KEY))
  } catch {
    return DEFAULT_COLOR_SCHEME
  }
}

// Spoločný stav pre prepínač v hlavičke aj v nastaveniach.
const preference = ref<ThemePreference>(readStored())
const scheme = ref<ColorScheme>(readStoredScheme())
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

  function setScheme(value: ColorScheme) {
    scheme.value = value
    try {
      localStorage.setItem(SCHEME_KEY, value)
    } catch {
      // súkromné okno a pod.
    }
  }

  return {
    preference,
    resolved,
    set,
    scheme,
    setScheme,
    /** Prepne systém → svetlá → tmavá → systém. */
    cycle: () => set(ORDER[(ORDER.indexOf(preference.value) + 1) % ORDER.length]!),
  }
}

/** Raz v koreni aplikácie: premietne zvolenú tému do Vuetify. */
/** `forceLight`: počas tlače sa použije svetlá téma bez ohľadu na voľbu (inak by svetlý text zmizol na papieri). */
export function useApplyTheme(forceLight?: Ref<boolean>) {
  const theme = useTheme()
  const { resolved, scheme } = useThemePreference()
  watchEffect(() => {
    const mode = forceLight?.value ? 'light' : resolved.value
    theme.change(themeName(scheme.value, mode))
    // Farba lišty prehliadača a nainštalovanej aplikácie podľa schémy.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', schemes[scheme.value][mode].primary)
  })
}
