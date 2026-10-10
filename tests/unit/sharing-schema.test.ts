import { describe, expect, it } from 'vitest'
import { createShareSchema } from '@shared/schemas/sharing'

const base = { kind: 'recipes' as const, recipeIds: ['r1'] }

describe('createShareSchema', () => {
  it('e-maily zmenší a odstráni duplicity', () => {
    const parsed = createShareSchema.parse({ ...base, emails: ['Svokra@Example.com', 'svokra@example.com '] })
    expect(parsed.emails).toEqual(['svokra@example.com'])
  })

  it('odmietne neplatný e-mail a viac ako 20 príjemcov', () => {
    expect(createShareSchema.safeParse({ ...base, emails: ['nie-je-mail'] }).success).toBe(false)
    const many = Array.from({ length: 21 }, (_, i) => `x${i}@example.com`)
    expect(createShareSchema.safeParse({ ...base, emails: many }).success).toBe(false)
    expect(createShareSchema.safeParse({ ...base, emails: [] }).success).toBe(false)
  })

  it('vyžaduje recepty, kategóriu alebo tag podľa druhu', () => {
    const emails = ['a@example.com']
    expect(createShareSchema.safeParse({ kind: 'recipes', emails }).success).toBe(false)
    expect(createShareSchema.safeParse({ kind: 'tag', emails }).success).toBe(false)
    expect(createShareSchema.safeParse({ kind: 'category', emails }).success).toBe(false)
    expect(createShareSchema.safeParse({ kind: 'category', emails, category: 'dezert' }).success).toBe(true)
    expect(createShareSchema.safeParse({ kind: 'tag', emails, tagId: 't1' }).success).toBe(true)
  })

  it('správa najviac 500 znakov, prázdna = bez správy', () => {
    const emails = ['a@example.com']
    expect(createShareSchema.safeParse({ ...base, emails, message: 'x'.repeat(501) }).success).toBe(false)
    expect(createShareSchema.parse({ ...base, emails, message: '  ' }).message).toBeNull()
  })
})
