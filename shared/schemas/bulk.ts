import { RECIPE_CATEGORIES, RECIPE_VISIBILITIES } from '../recipes'
import { UNIT_CODES } from '../units'
import { z } from './zod'

/** Najviac toľko položiek naraz (limit dopytov a viazaných hodnôt D1 na jedno volanie); klient väčší výber rozdelí. */
export const BULK_MAX = 50

const ids = z.array(z.string().min(1).max(40)).min(1, 'Nič nie je vybrané.').max(BULK_MAX)
const tagNames = z.array(z.string().trim().min(1).max(40)).max(10)

export const bulkIdsSchema = z.object({ ids })

const hasChange = (value: Record<string, unknown>) =>
  Object.entries(value).some(([key, v]) => key !== 'ids' && v !== undefined)

/** Hromadná úprava receptov: len vyplnené polia sa menia; obľúbené sa týka len prihláseného človeka. */
export const recipeBulkUpdateSchema = z
  .object({
    ids,
    category: z.enum(RECIPE_CATEGORIES).optional(),
    addTags: tagNames.optional(),
    removeTags: tagNames.optional(),
    favorite: z.boolean().optional(),
    visibility: z.enum(RECIPE_VISIBILITIES).optional(),
  })
  .refine(hasChange, 'Nie je čo zmeniť.')
export type RecipeBulkUpdate = z.output<typeof recipeBulkUpdateSchema>

export const ingredientBulkUpdateSchema = z
  .object({
    ids,
    shopCategoryId: z.string().max(40).nullable().optional(),
    defaultUnit: z.enum(UNIT_CODES).nullable().optional(),
  })
  .refine(hasChange, 'Nie je čo zmeniť.')
export type IngredientBulkUpdate = z.output<typeof ingredientBulkUpdateSchema>
