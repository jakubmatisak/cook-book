/** Jazyky aplikácie. */
export const LOCALES = ['sk', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]

export const RECIPE_VIEWS = ['grid', 'table'] as const
export type RecipeViewPreference = (typeof RECIPE_VIEWS)[number]

/** Hustota rozhrania na počítači (hodnoty `density` vo Vuetify); na mobile je vždy kompaktná. */
export const DENSITIES = ['compact', 'comfortable', 'default'] as const
export type Density = (typeof DENSITIES)[number]

/**
 * Nastavenia jedného človeka (nie domácnosti): platia vo všetkých jeho domácnostiach a na všetkých zariadeniach.
 * `recipeQuery` sú naposledy použité filtre a zoradenie zoznamu receptov ako parametre adresy.
 */
export interface UserSettingsDto {
  locale?: Locale
  theme?: ThemePreference
  recipeView?: RecipeViewPreference
  recipeQuery?: Record<string, string>
  /** Detské recepty (kaše, príkrmy) v aplikácii; `false` ich skryje všade. Predvolene zapnuté. */
  kidsEnabled?: boolean
  /** Hustota rozhrania na počítači; predvolene `comfortable`. */
  density?: Density
  /** Sekcia „V košíku“ v nákupnom zozname je rozbalená; predvolene áno. */
  shoppingCartOpen?: boolean
  /** Karta „Čo uvariť dnes“ v jedálničku je rozbalená; predvolene áno. */
  planSuggestionsOpen?: boolean
}
