import { z } from './zod'
import { daysBetween, isIsoDate } from '../dates'
import { RECIPE_CATEGORIES } from '../recipes'

export const MAX_PLAN_RANGE_DAYS = 62
export const MAX_COPY_DAYS = 14

const isoDate = z.string().refine(isIsoDate, 'Neplatný dátum.')

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))

export const planEntryInputSchema = z
  .object({
    date: isoDate,
    slotId: z.string().min(1).max(40),
    recipeId: z
      .string()
      .min(1)
      .max(40)
      .nullish()
      .transform((v) => v ?? null),
    freeText: optionalText(200),
    servingsOverride: z
      .number()
      .min(0.25)
      .max(100)
      .nullish()
      .transform((v) => v ?? null),
    note: optionalText(500),
    /** Návštevy pri tomto jedle (osoby typu guest z Rodiny). */
    guestIds: z
      .array(z.string().min(1).max(40))
      .max(20)
      .default([])
      .transform((ids) => [...new Set(ids)]),
  })
  .refine((e) => e.recipeId !== null || e.freeText !== null, {
    message: 'Vyber recept alebo napíš, čo sa bude jesť.',
    path: ['recipeId'],
  })
export type PlanEntryInput = z.output<typeof planEntryInputSchema>
export type PlanEntryInputRaw = z.input<typeof planEntryInputSchema>

export const MAX_STAY_DAYS = 62

/** Pobyt návštevy: členovia návštevy a dni od – do (vrátane), najviac ${MAX_STAY_DAYS} dní. */
export const guestStayInputSchema = z
  .object({
    memberIds: z
      .array(z.string().min(1).max(40))
      .min(1, 'Vyber aspoň jednu osobu z návštevy.')
      .max(20)
      .transform((ids) => [...new Set(ids)]),
    fromDate: isoDate,
    toDate: isoDate,
  })
  .refine((s) => s.fromDate <= s.toDate, {
    message: 'Pobyt sa nesmie končiť pred začiatkom.',
    path: ['toDate'],
  })
  .refine((s) => daysBetween(s.fromDate, s.toDate) < MAX_STAY_DAYS, {
    message: `Pobyt môže mať najviac ${MAX_STAY_DAYS} dní.`,
    path: ['toDate'],
  })
export type GuestStayInput = z.output<typeof guestStayInputSchema>

export const planRangeQuerySchema = z.object({ from: isoDate, to: isoDate }).refine(
  (r) => {
    const days = daysBetween(r.from, r.to)
    return days >= 0 && days < MAX_PLAN_RANGE_DAYS
  },
  { message: `Rozsah musí byť 1 až ${MAX_PLAN_RANGE_DAYS} dní.` },
)

export const planCopySchema = z.object({
  fromDate: isoDate,
  toDate: isoDate,
  days: z.number().int().min(1).max(MAX_COPY_DAYS).default(7),
  replace: z.boolean().default(false),
})
export type PlanCopyInput = z.output<typeof planCopySchema>

/** Vymazať všetky jedlá vybraných dní (najviac mesiac naraz). */
export const planClearSchema = z.object({
  dates: z
    .array(isoDate)
    .min(1, 'Vyber aspoň jeden deň.')
    .max(31)
    .transform((dates) => [...new Set(dates)]),
})
export type PlanClearInput = z.output<typeof planClearSchema>

export const templateCreateSchema = z.object({
  name: z.string().trim().min(1, 'Zadaj názov šablóny.').max(60, 'Názov môže mať najviac 60 znakov.'),
  fromDate: isoDate,
})
export type TemplateCreateInput = z.output<typeof templateCreateSchema>

export const templateApplySchema = z.object({
  toDate: isoDate,
  replace: z.boolean().default(false),
})
export type TemplateApplyInput = z.output<typeof templateApplySchema>

/** Zostaviť jedálniček: najviac 14 dní, štetce na políčkach (deň × jedlo dňa). */
export const MAX_COMPOSE_DAYS = 14

const composeSlotSchema = z.object({
  slotId: z.string().min(1).max(40),
  categories: z.array(z.enum(RECIPE_CATEGORIES)).min(1).max(RECIPE_CATEGORIES.length),
  withSoup: z.boolean().default(false),
})

export const composeRequestSchema = z
  .object({
    cells: z
      .array(
        z.object({
          date: isoDate,
          slotId: z.string().min(1).max(40),
          brush: z.enum(['all', 'verified', 'new', 'favorite']),
        }),
      )
      .min(1, 'Vyber aspoň jedno políčko.')
      .max(200),
    slots: z.array(composeSlotSchema).min(1).max(10),
    timeLimits: z.record(isoDate, z.enum(['do30', 'do60'])).default({}),
    tagIds: z.array(z.string().min(1).max(40)).max(20).default([]),
    leftoverDays: z.number().int().min(0).max(3).default(0),
    seed: z.number().int().min(0).max(2_147_483_647).default(1),
    /** Nahradiť aj obsadené políčka (inak sa ich obsah berie ako „už máme“). */
    replace: z.boolean().default(false),
  })
  .refine((r) => {
    const dates = r.cells.map((c) => c.date).sort()
    return daysBetween(dates[0]!, dates[dates.length - 1]!) < MAX_COMPOSE_DAYS
  }, `Najviac ${MAX_COMPOSE_DAYS} dní.`)
export type ComposeRequestInput = z.output<typeof composeRequestSchema>
export type ComposeRequestInputRaw = z.input<typeof composeRequestSchema>

export const composeApplySchema = z.object({
  replace: z.boolean().default(false),
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(120),
        date: isoDate,
        slotId: z.string().min(1).max(40),
        recipeId: z.string().min(1).max(40),
        leftoverOf: z.string().min(1).max(120).nullable(),
        leftoverDays: z.number().int().min(0).max(3).default(0),
      }),
    )
    .min(1)
    .max(200),
})
export type ComposeApplyInput = z.output<typeof composeApplySchema>
export type ComposeApplyInputRaw = z.input<typeof composeApplySchema>
