import { describe, expect, it } from 'vitest'
import { memberInputSchema, settingsUpdateSchema } from '@shared/schemas/family'
import { planCopySchema, planEntryInputSchema, planRangeQuerySchema } from '@shared/schemas/plan'

describe('planEntryInputSchema', () => {
  it('prijme recept alebo voľný text', () => {
    expect(planEntryInputSchema.parse({ date: '2026-10-05', slotId: 's', recipeId: 'r' })).toMatchObject({
      freeText: null,
      servingsOverride: null,
      note: null,
    })
    expect(
      planEntryInputSchema.parse({ date: '2026-10-05', slotId: 's', freeText: ' Zvyšky ' }).freeText,
    ).toBe('Zvyšky')
  })

  it('odmietne záznam bez receptu aj textu a neplatný dátum', () => {
    expect(planEntryInputSchema.safeParse({ date: '2026-10-05', slotId: 's', freeText: '  ' }).success).toBe(
      false,
    )
    expect(planEntryInputSchema.safeParse({ date: '2026-02-30', slotId: 's', recipeId: 'r' }).success).toBe(
      false,
    )
  })
})

describe('planRangeQuerySchema', () => {
  it('rozsah najviac 62 dní a od ≤ do', () => {
    expect(planRangeQuerySchema.safeParse({ from: '2026-10-05', to: '2026-10-11' }).success).toBe(true)
    expect(planRangeQuerySchema.safeParse({ from: '2026-10-05', to: '2026-12-31' }).success).toBe(false)
    expect(planRangeQuerySchema.safeParse({ from: '2026-10-11', to: '2026-10-05' }).success).toBe(false)
  })
})

describe('planCopySchema', () => {
  it('predvolene 7 dní bez nahradenia', () => {
    expect(planCopySchema.parse({ fromDate: '2026-10-05', toDate: '2026-10-12' })).toEqual({
      fromDate: '2026-10-05',
      toDate: '2026-10-12',
      days: 7,
      replace: false,
    })
    expect(planCopySchema.safeParse({ fromDate: '2026-10-05', toDate: '2026-10-12', days: 15 }).success).toBe(
      false,
    )
  })
})

describe('memberInputSchema a settingsUpdateSchema', () => {
  it('člen: meno povinné, koeficient v rozsahu', () => {
    expect(memberInputSchema.parse({ name: ' Ema ', kind: 'child' })).toMatchObject({
      name: 'Ema',
      kind: 'child',
      portionFactor: null,
      isActive: true,
    })
    expect(memberInputSchema.safeParse({ name: 'Ema', kind: 'child', portionFactor: 5 }).success).toBe(false)
    expect(memberInputSchema.safeParse({ name: '', kind: 'adult' }).success).toBe(false)
  })

  it('nastavenia odmietnu neznámy kľúč', () => {
    expect(settingsUpdateSchema.safeParse({ weekStartsOn: 0 }).success).toBe(true)
    expect(settingsUpdateSchema.safeParse({ weekStartsOn: 3 }).success).toBe(false)
    expect(settingsUpdateSchema.safeParse({ farba: 'modrá' }).success).toBe(false)
  })
})
