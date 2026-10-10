import { z } from './zod'
import { RECIPE_CATEGORIES } from '../recipes'
import { SHARE_KINDS, SHARE_LIMITS } from '../sharing'

const email = z
  .string()
  .trim()
  .max(200)
  .pipe(z.email({ error: 'Zadaj platný e-mail.' }))
  .transform((v) => v.toLowerCase())

const recipeIds = z.array(z.string().min(1)).min(1).max(SHARE_LIMITS.recipes)

/** Nová ponuka zdieľania: komu (e-maily), čo (recepty, kategória alebo tag) a nepovinná správa. */
export const createShareSchema = z
  .object({
    emails: z
      .array(email)
      .min(1, 'Zadaj aspoň jeden e-mail.')
      .transform((list) => [...new Set(list)])
      .pipe(
        z.array(z.string()).max(SHARE_LIMITS.recipients, `Naraz najviac ${SHARE_LIMITS.recipients} ľudí.`),
      ),
    kind: z.enum(SHARE_KINDS),
    recipeIds: recipeIds.optional(),
    category: z.enum(RECIPE_CATEGORIES).optional(),
    tagId: z.string().min(1).optional(),
    message: z
      .string()
      .trim()
      .max(SHARE_LIMITS.message)
      .nullish()
      .transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'recipes' && !v.recipeIds?.length)
      ctx.addIssue({ code: 'custom', path: ['recipeIds'], message: 'Vyber recepty.' })
    if (v.kind === 'category' && !v.category)
      ctx.addIssue({ code: 'custom', path: ['category'], message: 'Vyber typ jedla.' })
    if (v.kind === 'tag' && !v.tagId) ctx.addIssue({ code: 'custom', path: ['tagId'], message: 'Vyber tag.' })
  })
export type CreateShareInput = z.output<typeof createShareSchema>

/** Prijatie ponuky; bez `recipeIds` sa prijmú všetky recepty. */
export const acceptShareSchema = z.object({ recipeIds: recipeIds.optional() })

/** Recepty, ktoré odosielateľ odoberá zo zdieľania. */
export const shareItemsSchema = z.object({ recipeIds })

/** Kópia, pri ktorej sa skryje upozornenie na zmenu originálu. */
export const dismissNoticeSchema = z.object({ recipeId: z.string().min(1) })

/** Meno kontaktu (napr. „Svokra“); prázdne = bez mena. */
export const contactNameSchema = z.object({
  name: z
    .string()
    .trim()
    .max(SHARE_LIMITS.contactName)
    .nullish()
    .transform((v) => v || null),
})
