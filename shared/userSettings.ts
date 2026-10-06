/** Jazyky aplikácie. */
export const LOCALES = ['sk', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]

export const RECIPE_VIEWS = ['grid', 'table'] as const
export type RecipeViewPreference = (typeof RECIPE_VIEWS)[number]

/**
 * Nastavenia jedného človeka (nie domácnosti): platia vo všetkých jeho domácnostiach a na všetkých zariadeniach.
 * `recipeQuery` sú naposledy použité filtre a zoradenie zoznamu receptov ako parametre adresy.
 */
export interface UserSettingsDto {
  locale?: Locale
  theme?: ThemePreference
  recipeView?: RecipeViewPreference
  recipeQuery?: Record<string, string>
}
