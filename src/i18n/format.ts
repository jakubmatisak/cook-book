import { currentLocale, t } from './index'

/** Číslo podľa jazyka (desatinná čiarka v slovenčine), najviac 2 desatinné miesta. */
export const formatNumber = (n: number): string =>
  new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 2 }).format(n)

/** Preklad s množným číslom: `tc('plural.portions', 1.5)` → „1,5 porcie“ (v kľúči tvary oddelené `|`, číslo je `{n}`). */
export const tc = (key: string, n: number, named: Record<string, unknown> = {}): string =>
  t(key, { ...named, n: formatNumber(n) }, n)

/** 45 → „45 min“, 90 → „1 h 30 min“. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return t('common.minutes', { n: minutes })
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? t('common.hoursMinutes', { h, m }) : t('common.hours', { h })
}

const toDate = (iso: string): Date => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}
const intl = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(currentLocale(), { timeZone: 'UTC', ...options })
const capitalize = (s: string): string => s.charAt(0).toLocaleUpperCase(currentLocale()) + s.slice(1)

/** „2026-10-05“ → „5. 10. 2026“ (sk) / „10/5/2026“ (en). */
export const formatDate = (iso: string): string =>
  intl({ day: 'numeric', month: 'numeric', year: 'numeric' }).format(toDate(iso))

/** Označenie dňa: krátky názov („PO“), dlhý („Pondelok“) a dátum bez roku („5. 10.“). */
export function formatDayLabel(iso: string): { short: string; long: string; date: string } {
  const d = toDate(iso)
  return {
    short: intl({ weekday: 'short' }).format(d).toLocaleUpperCase(currentLocale()).replace(/\.$/, ''),
    long: capitalize(intl({ weekday: 'long' }).format(d)),
    date: intl({ day: 'numeric', month: 'numeric' }).format(d),
  }
}

/** Rozsah týždňa: sk „5. – 11. 10. 2026“, „26. 10. – 1. 11. 2026“; en „Oct 5 – 11, 2026“. */
export function formatWeekRange(startIso: string): string {
  const start = toDate(startIso)
  const end = new Date(start.getTime() + 6 * 86_400_000)
  if (currentLocale() !== 'sk') {
    return intl({ day: 'numeric', month: 'short', year: 'numeric' }).formatRange(start, end)
  }
  const a = { d: start.getUTCDate(), m: start.getUTCMonth() + 1, y: start.getUTCFullYear() }
  const b = { d: end.getUTCDate(), m: end.getUTCMonth() + 1, y: end.getUTCFullYear() }
  if (a.y !== b.y) return `${a.d}. ${a.m}. ${a.y} – ${b.d}. ${b.m}. ${b.y}`
  if (a.m !== b.m) return `${a.d}. ${a.m}. – ${b.d}. ${b.m}. ${b.y}`
  return `${a.d}. – ${b.d}. ${b.m}. ${b.y}`
}
