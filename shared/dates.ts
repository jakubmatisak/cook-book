/**
 * Dátumy ako reťazce `YYYY-MM-DD`. Počítame v UTC, aby zmena času ani časové pásmo
 * nikdy neposunuli deň.
 */

const DAY_MS = 86_400_000

const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const ms = toUtc(value)
  return Number.isFinite(ms) && fromUtc(ms) === value
}

export const addDays = (iso: string, days: number) => fromUtc(toUtc(iso) + days * DAY_MS)

/** 0 = nedeľa … 6 = sobota */
export const weekday = (iso: string) => new Date(toUtc(iso)).getUTCDay()

export function startOfWeek(iso: string, weekStartsOn: number): string {
  const diff = (weekday(iso) - weekStartsOn + 7) % 7
  return addDays(iso, -diff)
}

export const weekDates = (startIso: string) => Array.from({ length: 7 }, (_, i) => addDays(startIso, i))

export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / DAY_MS)

/** Dnešný dátum podľa lokálneho času zariadenia. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const SHORT = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So']
const LONG = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota']

const parts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return { y, m, d }
}

export function formatDayLabel(iso: string): { short: string; long: string; date: string } {
  const { m, d } = parts(iso)
  const wd = weekday(iso)
  return { short: SHORT[wd]!, long: LONG[wd]!, date: `${d}. ${m}.` }
}

/** „5. – 11. 10. 2026“, „26. 10. – 1. 11. 2026“, „28. 12. 2026 – 3. 1. 2027“ */
export function formatWeekRange(startIso: string): string {
  const a = parts(startIso)
  const b = parts(addDays(startIso, 6))
  if (a.y !== b.y) return `${a.d}. ${a.m}. ${a.y} – ${b.d}. ${b.m}. ${b.y}`
  if (a.m !== b.m) return `${a.d}. ${a.m}. – ${b.d}. ${b.m}. ${b.y}`
  return `${a.d}. – ${b.d}. ${b.m}. ${b.y}`
}
