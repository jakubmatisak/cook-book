import { z } from './zod'
import { daysBetween, isIsoDate } from '../dates'

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
