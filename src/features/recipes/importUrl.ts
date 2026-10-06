/** Adresa bez úvodného „https://“ (napr. skopírovaná z lišty) sa doplní. */
export const normalizeUrl = (value: string) => (/^https?:\/\//i.test(value) ? value : `https://${value}`)

/**
 * Adresa receptu z parametra `url` (rozšírenie do Chromu, záložka): prvá hodnota, doplnený protokol.
 * Chýbajúca, prázdna alebo neplatná adresa (aj iný protokol než http/https) dá `null`.
 */
export function importTargetFromQuery(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed || /^(?!https?:)[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return null
  const url = normalizeUrl(trimmed)
  try {
    return new URL(url).hostname ? url : null
  } catch {
    return null
  }
}
