export { formatMinutes, plural, totalMinutes } from '@shared/format'

/** "2026-10-05" na "5. 10. 2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d}. ${m}. ${y}`
}
