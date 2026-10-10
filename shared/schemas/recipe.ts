import { SAMPLE_SET_NAMES } from '../data/sampleSets'
import { z } from './zod'
import { isIsoDate } from '../dates'
import { SORT_KEYS, TIME_BUCKETS } from '../recipeFacets'
import { RECIPE_CATEGORIES, RECIPE_VISIBILITIES } from '../recipes'
import { normalizeText } from '../text'
import { UNIT_CODES } from '../units'

const emptyToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)

/** Voliteľný text: prázdny alebo chýbajúci → null. */
const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullish()).transform((v) => v ?? null)

const optionalInt = (min: number, max: number) =>
  z
    .number()
    .int()
    .min(min)
    .max(max)
    .nullish()
    .transform((v) => v ?? null)

export const recipeIngredientInputSchema = z.object({
  name: z.string().trim().min(1, 'Zadaj názov ingrediencie.').max(120),
  quantity: z
    .number()
    .positive('Množstvo musí byť kladné.')
    .max(100_000)
    .nullish()
    .transform((v) => v ?? null),
  unit: z
    .enum(UNIT_CODES)
    .nullish()
    .transform((v) => v ?? null),
  note: optionalText(200),
  groupName: optionalText(80),
  isOptional: z.boolean().default(false),
})

export const recipeStepInputSchema = z.object({
  text: z.string().trim().min(1, 'Krok nesmie byť prázdny.').max(5000),
  timerSeconds: optionalInt(1, 86_400),
})

export const recipeInputSchema = z.object({
  title: z.string().trim().min(1, 'Zadaj názov receptu.').max(200),
  description: optionalText(5000),
  category: z.enum(RECIPE_CATEGORIES).default('hlavne'),
  servings: z.number().int().min(1).max(50).default(4),
  prepMinutes: optionalInt(0, 1440),
  cookMinutes: optionalInt(0, 1440),
  difficulty: z.number().int().min(1).max(3).default(1),
  sourceUrl: z
    .preprocess(emptyToNull, z.url({ protocol: /^https?$/, error: 'Zadaj platnú webovú adresu.' }).nullish())
    .transform((v) => v ?? null),
  sourceText: optionalText(500),
  /**
   * Voľné poznámky (odhady, pôvodný zápis); univerzálne pre každý recept. Chýbajúce pole = ponechať (staršia verzia
   * aplikácie ho neposiela), prázdne = vymazať.
   */
  notes: z.preprocess(emptyToNull, z.string().trim().max(20_000).nullish()),
  coverImageId: optionalText(40),
  /** Overený recept; chýba = nemení sa (staršia verzia aplikácie). */
  isVerified: z.boolean().optional(),
  /** „Hodí sa aj ako“: ďalšie typy jedla; chýba = nemení sa (staršia verzia aplikácie). */
  alsoCategories: z
    .array(z.enum(RECIPE_CATEGORIES))
    .max(RECIPE_CATEGORIES.length * 2)
    .optional(),
  /** Prílohy (fotky) v poradí galérie; opakované ID sa vynechá. Chýbajúce pole = ponechať doterajšie. */
  attachmentIds: z
    .array(z.string().trim().min(1).max(40))
    .max(30)
    .optional()
    .transform((ids) => (ids ? [...new Set(ids)] : undefined)),
  ingredients: z.array(recipeIngredientInputSchema).max(100).default([]),
  steps: z.array(recipeStepInputSchema).max(100).default([]),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(30)
    .default([])
    .transform((tags) => {
      const seen = new Set<string>()
      return tags.filter((tag) => {
        const key = normalizeText(tag)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }),
})

export type RecipeInput = z.output<typeof recipeInputSchema>
export type RecipeInputRaw = z.input<typeof recipeInputSchema>
export type RecipeIngredientInput = z.output<typeof recipeIngredientInputSchema>

/** Zoznam hodnôt oddelených čiarkou (`?category=hlavne,dezert`); chýbajúci parameter = prázdny zoznam. */
const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (v) =>
      typeof v === 'string'
        ? v
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .slice(0, 50)
        : [],
    z.array(item),
  )

export const recipeListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: csv(z.enum(RECIPE_CATEGORIES)),
  tag: csv(z.string().max(40)),
  difficulty: csv(z.coerce.number().int().min(1).max(3)),
  time: csv(z.enum(TIME_BUCKETS)),
  /** `kids=1`: zahrnúť aj detské recepty (inak sa skrývajú); `kids=only`: len detské. */
  kids: z
    .enum(['1', 'true', 'only'])
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v === 'only' ? ('only' as const) : ('include' as const),
    ),
  /**
   * Verejné recepty iných domácností v zozname: `hide` ich nezobrazí, `include` ich pridá k mojim, `only` ukáže
   * len cudzie. Bez parametra rozhodne nastavenie človeka „Zobrazovať recepty od iných“ (predvolene `hide`).
   */
  public: z.enum(['hide', 'include', 'only']).optional(),
  /** `shared=only`: len recepty, ktoré so mnou zdieľajú iné domácnosti. */
  shared: z.enum(['only']).optional(),
  /** Len moje recepty, ktoré niekomu zdieľam. */
  sharedByMe: z
    .enum(['1', 'true'])
    .optional()
    .transform((v) => v !== undefined),
  /** Najviac toľko chýbajúcich surovín (len s `pantry=1`). */
  missing: z.coerce.number().int().min(0).max(20).optional(),
  sort: z.enum(SORT_KEYS).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  favorite: z
    .enum(['1', 'true'])
    .optional()
    .transform((v) => v !== undefined),
  /** Len overené recepty domácnosti. */
  verified: z
    .enum(['1', 'true'])
    .optional()
    .transform((v) => v !== undefined),
  /** Zoradiť podľa toho, čo je doma, a vrátiť chýbajúce ingrediencie. */
  pantry: z
    .enum(['1', 'true'])
    .optional()
    .transform((v) => v !== undefined),
})

export const recipeVisibilitySchema = z.object({ visibility: z.enum(RECIPE_VISIBILITIES) })

/** Zoznam verejných receptov: hľadanie podľa názvu a typ jedla (zoznam oddelený čiarkou). */
export const publicRecipeListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: csv(z.enum(RECIPE_CATEGORIES)),
})

export const recipeImportSchema = z.object({
  url: z.url({ protocol: /^https?$/, error: 'Zadaj platnú webovú adresu (http alebo https).' }),
})

const servingsParam = z.coerce.number().int().min(1).max(50).optional()

export const markdownQuerySchema = z
  .object({
    /** Prepočítať množstvá na tento počet porcií. */
    servings: servingsParam,
    /** Starší názov parametra (aplikácia nainštalovaná pred prechodom na anglické adresy). */
    porcie: servingsParam,
  })
  .transform(({ servings, porcie }) => ({ servings: servings ?? porcie }))

/** Ktorú sadu ukážkových receptov pridať (predvolene základnú). */
export const sampleSetQuerySchema = z.object({ set: z.enum(SAMPLE_SET_NAMES).default('basic') })

export const suggestionsQuerySchema = z.object({
  date: z.string().refine(isIsoDate, 'Neplatný dátum.'),
})

export const tagInputSchema = z.object({
  name: z.string().trim().min(1, 'Zadaj názov tagu.').max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Farba v tvare #RRGGBB.')
    .nullish()
    .transform((v) => v ?? null),
})
export type TagInput = z.output<typeof tagInputSchema>

export const ingredientUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  defaultUnit: z.enum(UNIT_CODES).nullable().optional(),
  shopCategoryId: z.string().max(40).nullable().optional(),
})

export const ingredientCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  defaultUnit: z.enum(UNIT_CODES).nullable().optional(),
  shopCategoryId: z.string().max(40).nullable().optional(),
})
