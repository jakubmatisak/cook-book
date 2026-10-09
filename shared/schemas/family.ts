import { z } from './zod'
import { isIsoDate } from '../dates'
import { MEMBER_KINDS } from '../family'

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Farba v tvare #RRGGBB.')
  .nullish()
  .transform((v) => v ?? null)

export const memberInputSchema = z.object({
  name: z.string().trim().min(1, 'Zadaj meno.').max(60),
  kind: z.enum(MEMBER_KINDS),
  /** null → predvolený koeficient podľa typu (dospelý 1, dieťa z nastavení). */
  portionFactor: z
    .number()
    .min(0.1, 'Najmenej 0,1.')
    .max(3, 'Najviac 3.')
    .nullish()
    .transform((v) => v ?? null),
  birthDate: z
    .string()
    .refine(isIsoDate, 'Neplatný dátum.')
    .nullish()
    .transform((v) => v ?? null),
  color: hexColor,
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).optional(),
})
export type MemberInput = z.output<typeof memberInputSchema>
export type MemberInputRaw = z.input<typeof memberInputSchema>

export const slotUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    isEnabled: z.boolean().optional(),
    defaultTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Čas v tvare HH:MM.')
      .nullable()
      .optional(),
    sortOrder: z.number().int().min(0).max(100).optional(),
  })
  .strict()
export type SlotUpdate = z.output<typeof slotUpdateSchema>

export const settingsUpdateSchema = z
  .object({
    weekStartsOn: z.union([z.literal(0), z.literal(1), z.literal(6)]).optional(),
    childPortionFactor: z.number().min(0.1).max(3).optional(),
    ignoreSpicesInPantry: z.boolean().optional(),
  })
  .strict()
export type SettingsUpdate = z.output<typeof settingsUpdateSchema>

const idList = z.array(z.string().min(1).max(40)).max(50).default([])

/** Preferencie člena: ingrediencie (alergie, averzie) a tagy (diéty) podľa id; ukladajú sa naraz. */
/** Neobľúbené jedlo: recept z kuchárky, alebo voľný text, keď v kuchárke nie je. */
const dislikedRecipe = z
  .object({
    recipeId: z.string().min(1).max(40).nullish(),
    text: z.string().trim().max(120).nullish(),
  })
  .refine((r) => Boolean(r.recipeId) || Boolean(r.text), 'Vyber recept alebo napíš názov jedla.')

export const memberPreferencesSchema = z.object({
  allergies: idList,
  dislikes: idList,
  diets: idList,
  /** Chýba = nemení sa (staršia verzia aplikácie). */
  dislikedRecipes: z.array(dislikedRecipe).max(50).optional(),
})
export type MemberPreferencesInput = z.output<typeof memberPreferencesSchema>
