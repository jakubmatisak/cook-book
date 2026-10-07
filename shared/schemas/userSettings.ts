import { z } from './zod'
import { DENSITIES, LOCALES, RECIPE_VIEWS, THEME_PREFERENCES } from '../userSettings'

/** Predvolené filtre: pár parametrov adresy s rozumným limitom, aby sa do nastavení nedal uložiť odpad. */
const recipeQuery = z
  .record(z.string().min(1).max(30), z.string().max(200))
  .refine((q) => Object.keys(q).length <= 12, 'Príliš veľa filtrov.')

/** Zmena nastavení: vynechaný kľúč sa nemení, `null` ho vymaže (návrat na predvolené). */
export const userSettingsUpdateSchema = z
  .object({
    locale: z.enum(LOCALES).nullable().optional(),
    theme: z.enum(THEME_PREFERENCES).nullable().optional(),
    recipeView: z.enum(RECIPE_VIEWS).nullable().optional(),
    recipeQuery: recipeQuery.nullable().optional(),
    kidsEnabled: z.boolean().nullable().optional(),
    density: z.enum(DENSITIES).nullable().optional(),
    shoppingCartOpen: z.boolean().nullable().optional(),
    planSuggestionsOpen: z.boolean().nullable().optional(),
  })
  .strict()
export type UserSettingsUpdate = z.output<typeof userSettingsUpdateSchema>
