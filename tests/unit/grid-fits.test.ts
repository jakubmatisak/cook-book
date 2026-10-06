import { describe, expect, it } from 'vitest'
import { GRID_MIN_WIDTH, gridFits } from '@/features/meal-plan/week'

describe('gridFits', () => {
  it('týždenná mriežka sa ukáže, až keď sa zmestí bez vodorovného posuvníka', () => {
    expect(gridFits(GRID_MIN_WIDTH)).toBe(true)
    expect(gridFits(GRID_MIN_WIDTH - 1)).toBe(false)
    expect(gridFits(1152)).toBe(true)
    expect(gridFits(900)).toBe(false)
    expect(gridFits(375)).toBe(false)
  })

  it('minimálna šírka sedí so stĺpcami: popisy riadkov 7 rem a 7 dní po 8 rem', () => {
    expect(GRID_MIN_WIDTH).toBe((7 + 7 * 8) * 16)
  })
})
