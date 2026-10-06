import { describe, expect, it } from 'vitest'
import { MEMBER_KINDS, MEMBER_KIND_LABELS } from '@shared/family'
import { entryPortions } from '@shared/portions'
import { preferenceConflicts, type PreferenceMember } from '@shared/preferences'
import { planShopping, type ShoppingInputEntry } from '@shared/shopping'

const adult = { id: 'a1', kind: 'adult' as const, portionFactor: 1, isActive: true }
const guest = { id: 'g1', kind: 'guest' as const, portionFactor: 1, isActive: true }
const otherGuest = { id: 'g2', kind: 'guest' as const, portionFactor: 1, isActive: true }

describe('návšteva ako typ osoby', () => {
  it('je medzi typmi osôb a má slovenský názov', () => {
    expect(MEMBER_KINDS).toContain('guest')
    expect(MEMBER_KIND_LABELS.guest).toBe('Návšteva')
  })
})

describe('porcie s návštevou', () => {
  it('návšteva sa nepočíta, kým nie je pri jedle vybraná', () => {
    expect(entryPortions({ servingsOverride: null, audience: 'all' }, [adult, guest])).toBe(1)
    expect(entryPortions({ servingsOverride: null, audience: 'all', guestIds: [] }, [adult, guest])).toBe(1)
  })

  it('vybraná návšteva sa pripočíta, nevybraná nie', () => {
    const entry = { servingsOverride: null, audience: 'all' as const, guestIds: ['g1'] }
    expect(entryPortions(entry, [adult, guest, otherGuest])).toBe(2)
  })

  it('vybraná návšteva sa počíta aj pri jedle len pre deti, nečinná návšteva nie', () => {
    const entry = { servingsOverride: null, audience: 'children' as const, guestIds: ['g1'] }
    expect(entryPortions(entry, [adult, guest])).toBe(1)
    expect(entryPortions(entry, [{ ...guest, isActive: false }])).toBeNull()
  })

  it('ručné porcie majú prednosť aj pred návštevou', () => {
    expect(entryPortions({ servingsOverride: 6, audience: 'all', guestIds: ['g1'] }, [adult, guest])).toBe(6)
  })
})

describe('upozornenia na alergie návštevy', () => {
  const member = (id: string, kind: PreferenceMember['kind'], label: string): PreferenceMember => ({
    id,
    name: id,
    kind,
    isActive: true,
    preferences: [{ kind: 'allergy', ingredientId: 'orechy', tagId: null, label }],
  })
  const recipe = { ingredientIds: ['orechy'], tagIds: [] }

  it('alergia návštevy upozorní len pri jedle, kde je návšteva vybraná', () => {
    const members = [member('a1', 'adult', 'Orechy'), member('g1', 'guest', 'Orechy')]
    expect(preferenceConflicts(recipe, members, 'all').map((w) => w.memberId)).toEqual(['a1'])
    expect(preferenceConflicts(recipe, members, 'all', ['g1']).map((w) => w.memberId)).toEqual(['a1', 'g1'])
  })
})

describe('nákup s návštevou', () => {
  const entry = (guestIds: string[]): ShoppingInputEntry => ({
    id: 'e1',
    date: '2026-10-06',
    servingsOverride: null,
    audience: 'all',
    guestIds,
    recipe: {
      id: 'r1',
      title: 'Guláš',
      servings: 2,
      ingredients: [
        {
          recipeIngredientId: 'ri1',
          ingredientId: 'maso',
          name: 'mäso',
          quantity: 200,
          unit: 'g',
          isOptional: false,
          shopCategoryId: null,
        },
      ],
    },
  })

  it('nakúpi viac, keď je pri jedle vybraná návšteva', () => {
    const members = [adult, guest]
    const without = planShopping({ entries: [entry([])], members }).items[0]!.quantity
    const withGuest = planShopping({ entries: [entry(['g1'])], members }).items[0]!.quantity
    expect(without).toBe(100)
    expect(withGuest).toBe(200)
  })
})
