import { describe, expect, it } from 'vitest'
import type { MealSlotDto } from '@shared/api'
import { pickSlotForNow } from '@/features/meal-plan/week'

const slot = (id: string, sortOrder: number, defaultTime: string | null, isEnabled = true): MealSlotDto => ({
  id,
  name: id,
  sortOrder,
  isEnabled,
  defaultTime,
})

const slots = [
  slot('ranajky', 0, '07:30'),
  slot('obed', 1, '12:00'),
  slot('vecera', 2, '18:30'),
  slot('nocna', 3, '22:00', false),
]

describe('pickSlotForNow', () => {
  it('vyberie najbližšie jedlo dňa, ktoré ešte nezačalo', () => {
    expect(pickSlotForNow(slots, 6 * 60)?.id).toBe('ranajky')
    expect(pickSlotForNow(slots, 9 * 60)?.id).toBe('obed')
    expect(pickSlotForNow(slots, 12 * 60)?.id).toBe('obed')
    expect(pickSlotForNow(slots, 13 * 60)?.id).toBe('vecera')
  })

  it('po poslednom jedle dňa vyberie posledné zapnuté jedlo', () => {
    expect(pickSlotForNow(slots, 23 * 60)?.id).toBe('vecera')
  })

  it('vypnuté jedlá preskočí a bez času dá prvé zapnuté', () => {
    expect(pickSlotForNow([slot('a', 0, null), slot('b', 1, null)], 10 * 60)?.id).toBe('a')
    expect(pickSlotForNow([slot('off', 0, '08:00', false), slot('on', 1, '09:00')], 7 * 60)?.id).toBe('on')
  })

  it('bez zapnutých jedál vráti undefined', () => {
    expect(pickSlotForNow([], 8 * 60)).toBeUndefined()
    expect(pickSlotForNow([slot('off', 0, '08:00', false)], 8 * 60)).toBeUndefined()
  })
})
