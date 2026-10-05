/** 45 → „45 min“, 90 → „1 h 30 min“. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function totalMinutes(prep: number | null, cook: number | null): number | null {
  if (prep === null && cook === null) return null
  return (prep ?? 0) + (cook ?? 0)
}

/** Slovenský tvar podľa počtu: 1 porcia, 2–4 porcie, 0 a 5+ porcií, desatinné „1,5 porcie“. */
export function plural(n: number, one: string, few: string, many: string): string {
  const shown = String(n).replace('.', ',')
  if (!Number.isInteger(n)) return `${shown} ${few}`
  if (n === 1) return `${shown} ${one}`
  if (n >= 2 && n <= 4) return `${shown} ${few}`
  return `${shown} ${many}`
}

/** "2026-10-05" na "5. 10. 2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d}. ${m}. ${y}`
}
