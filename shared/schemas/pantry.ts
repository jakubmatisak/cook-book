import { isIsoDate } from '../dates'
import { UNIT_CODES } from '../units'
import { z } from './zod'

const quantity = z
  .number()
  .positive('Množstvo musí byť kladné.')
  .max(100_000)
  .nullish()
  .transform((v) => v ?? null)

const unit = z
  .enum(UNIT_CODES)
  .nullish()
  .transform((v) => v ?? null)

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))

/** Zásoba jednej ingrediencie doma. Bez množstva sa jednotka zahodí (nemá čo upresňovať). */
export const pantryItemSchema = z
  .object({
    quantity,
    unit,
    expiresOn: z
      .string()
      .refine(isIsoDate, 'Zadaj dátum vo formáte RRRR-MM-DD.')
      .nullish()
      .transform((v) => v ?? null),
    location: optionalText(60),
  })
  .transform((v) => (v.quantity === null ? { ...v, unit: null } : v))
export type PantryItemInput = z.output<typeof pantryItemSchema>

const everyNWeeks = z.number().int('Rytmus musí byť celé číslo týždňov.').min(1).max(12)

export const stapleCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'Zadaj názov položky.').max(120),
    quantity,
    unit,
    everyNWeeks: everyNWeeks.default(1),
  })
  .transform((v) => (v.quantity === null ? { ...v, unit: null } : v))
export type StapleCreateInput = z.output<typeof stapleCreateSchema>

export const stapleUpdateSchema = z.object({
  quantity: z.number().positive('Množstvo musí byť kladné.').max(100_000).nullable().optional(),
  unit: z.enum(UNIT_CODES).nullable().optional(),
  everyNWeeks: everyNWeeks.optional(),
})
export type StapleUpdateInput = z.output<typeof stapleUpdateSchema>
