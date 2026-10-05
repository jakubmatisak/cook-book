import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  formatDayLabel,
  formatWeekRange,
  isIsoDate,
  startOfWeek,
  todayIso,
  weekDates,
  weekday,
} from '@shared/dates'

describe('isIsoDate', () => {
  it('prijme len skutočné dátumy YYYY-MM-DD', () => {
    expect(isIsoDate('2026-10-05')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('5.10.2026')).toBe(false)
  })
})

describe('aritmetika dátumov', () => {
  it('addDays prejde cez mesiac, rok aj zmenu času', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('weekday: 0 je nedeľa', () => {
    expect(weekday('2026-10-05')).toBe(1)
    expect(weekday('2026-10-11')).toBe(0)
  })

  it('startOfWeek pre pondelok aj nedeľu', () => {
    expect(startOfWeek('2026-10-08', 1)).toBe('2026-10-05')
    expect(startOfWeek('2026-10-11', 1)).toBe('2026-10-05')
    expect(startOfWeek('2026-10-11', 0)).toBe('2026-10-11')
    expect(startOfWeek('2026-10-10', 0)).toBe('2026-10-04')
  })

  it('weekDates vráti 7 po sebe idúcich dní aj cez zmenu času', () => {
    expect(weekDates('2026-10-26')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ])
  })

  it('daysBetween', () => {
    expect(daysBetween('2026-10-05', '2026-10-12')).toBe(7)
    expect(daysBetween('2026-10-12', '2026-10-05')).toBe(-7)
  })

  it('todayIso berie lokálny dátum', () => {
    expect(todayIso(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05')
  })
})

describe('popisy po slovensky', () => {
  it('formatDayLabel', () => {
    expect(formatDayLabel('2026-10-05')).toEqual({ short: 'Po', long: 'pondelok', date: '5. 10.' })
    expect(formatDayLabel('2026-10-11')).toEqual({ short: 'Ne', long: 'nedeľa', date: '11. 10.' })
  })

  it('formatWeekRange v rámci mesiaca aj cez mesiace a roky', () => {
    expect(formatWeekRange('2026-10-05')).toBe('5. – 11. 10. 2026')
    expect(formatWeekRange('2026-10-26')).toBe('26. 10. – 1. 11. 2026')
    expect(formatWeekRange('2026-12-28')).toBe('28. 12. 2026 – 3. 1. 2027')
  })
})
