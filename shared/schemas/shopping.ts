import { z } from './zod'
import { daysBetween, isIsoDate } from '../dates'
import { UNIT_CODES } from '../units'

export const MAX_GENERATE_DAYS = 31

const isoDate = z.string().refine(isIsoDate, 'Neplatný dátum.')

export const generateSchema = z.object({ from: isoDate, to: isoDate }).refine(
  (r) => {
    const days = daysBetween(r.from, r.to)
    return days >= 0 && days < MAX_GENERATE_DAYS
  },
  { message: `Rozsah musí byť 1 až ${MAX_GENERATE_DAYS} dní.` },
)
export type GenerateInput = z.output<typeof generateSchema>

const quantity = z
  .number()
  .positive()
  .max(100_000)
  .nullish()
  .transform((v) => v ?? null)

const unit = z
  .enum(UNIT_CODES)
  .nullish()
  .transform((v) => v ?? null)

export const itemCreateSchema = z.object({
  name: z.string().trim().min(1, 'Zadaj, čo kúpiť.').max(120),
  quantity,
  unit,
  shopCategoryId: z
    .string()
    .max(40)
    .nullish()
    .transform((v) => v ?? null),
})
export type ItemCreateInput = z.output<typeof itemCreateSchema>

export const itemPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    quantity: z.number().positive().max(100_000).nullable().optional(),
    unit: z.enum(UNIT_CODES).nullable().optional(),
    shopCategoryId: z.string().max(40).nullable().optional(),
    isChecked: z.boolean().optional(),
  })
  .strict()
export type ItemPatchInput = z.output<typeof itemPatchSchema>

/** Odškrtnutia nahromadené bez signálu; `at` = čas zmeny na telefóne (ISO), staršia zmena nevyhrá. */
export const itemBatchSchema = z.object({
  changes: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        isChecked: z.boolean(),
        at: z.iso.datetime(),
      }),
    )
    .max(500),
})
export type ItemBatchInput = z.output<typeof itemBatchSchema>

/** Označiť / zrušiť označenie viacerých položiek naraz (čas zmení server). */
export const itemCheckSchema = z.object({
  isChecked: z.boolean(),
  ids: z.array(z.string().min(1).max(40)).min(1).max(1000),
})
export type ItemCheckInput = z.output<typeof itemCheckSchema>
