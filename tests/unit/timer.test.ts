import { describe, expect, it } from 'vitest'
import {
  createTimer,
  formatTimer,
  pauseTimer,
  resetTimer,
  startTimer,
  tickTimer,
} from '@/composables/useTimer'

describe('časovač', () => {
  it('beží, odpočítava a na konci je hotový', () => {
    let t = startTimer(createTimer(90_000), 1_000)
    expect(t).toMatchObject({ status: 'running', endsAt: 91_000, remainingMs: 90_000 })
    t = tickTimer(t, 31_000)
    expect(t).toMatchObject({ status: 'running', remainingMs: 60_000 })
    t = tickTimer(t, 95_000)
    expect(t).toMatchObject({ status: 'done', remainingMs: 0, endsAt: null })
  })

  it('pozastavenie zapamätá zvyšok a pokračuje od neho', () => {
    let t = startTimer(createTimer(60_000), 0)
    t = pauseTimer(t, 20_000)
    expect(t).toMatchObject({ status: 'paused', remainingMs: 40_000, endsAt: null })
    expect(tickTimer(t, 500_000)).toEqual(t)
    t = startTimer(t, 100_000)
    expect(t.endsAt).toBe(140_000)
  })

  it('reset vráti pôvodný čas a hotový časovač sa dá spustiť znova od začiatku', () => {
    let t = tickTimer(startTimer(createTimer(30_000), 0), 40_000)
    expect(t.status).toBe('done')
    t = startTimer(t, 50_000)
    expect(t).toMatchObject({ status: 'running', endsAt: 80_000 })
    expect(resetTimer(t)).toMatchObject({ status: 'idle', remainingMs: 30_000, endsAt: null })
  })
})

describe('formatTimer', () => {
  it('minúty a sekundy, nad hodinu aj hodiny, zaokrúhlené nahor', () => {
    expect(formatTimer(90_000)).toBe('1:30')
    expect(formatTimer(9_100)).toBe('0:10')
    expect(formatTimer(3_725_000)).toBe('1:02:05')
    expect(formatTimer(0)).toBe('0:00')
  })
})
