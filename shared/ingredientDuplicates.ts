import { normalizeText } from './text'
import { toBase, type UnitCode } from './units'

/**
 * Slovenské koncovky (najdlhšie prvé), ktoré sa pri porovnaní odrežú: „Paradajky“ = „Paradajka“, „mlieka“ =
 * „Mlieko“, „Lieskové orechy“ = „orechy lieskové“. Preklepy (líšia sa písmenom) sa zámerne nehľadajú – na
 * skutočných dátach dávali nezmysly (Bagety – Batáty, Hruška – Treska).
 */
const SUFFIXES = [
  'ovych',
  'ovymi',
  'ymi',
  'ych',
  'ami',
  'ach',
  'ove',
  'ova',
  'ovy',
  'om',
  'ou',
  'ov',
  'ie',
  'ia',
  'iu',
]
const SHORT_SUFFIXES = ['y', 'a', 'e', 'i', 'u', 'o']
/** Kmeň musí mať aspoň toľko písmen, nech sa krátke slová (syr, olej) neskrátia na nič. */
const MIN_STEM = 3

function stem(word: string): string {
  for (const suffix of [...SUFFIXES, ...SHORT_SUFFIXES]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= MIN_STEM) return word.slice(0, -suffix.length)
  }
  return word
}

/** Kľúč, podľa ktorého sú dva názvy tá istá ingrediencia (bez diakritiky, tvaru slov a poradia). */
export function duplicateKey(name: string): string {
  const words = normalizeText(name)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(stem)
  return [...new Set(words)].sort().join(' ')
}

/** Kľúč skupiny na ignorovanie: konkrétne ingrediencie (pribudne ďalšia → návrh sa ukáže znova). */
export const ignoreKey = (ids: readonly string[]): string => [...ids].sort().join(',')

export interface DuplicateGroup {
  key: string
  /** Najpoužívanejšia prvá. */
  ids: string[]
  targetId: string
}

/** Skupiny ingrediencií, ktoré sú pravdepodobne tá istá; počítajú sa vždy z aktuálneho zoznamu. */
export function findDuplicateGroups(
  items: readonly { id: string; name: string; usageCount: number }[],
  ignored: readonly string[],
): DuplicateGroup[] {
  const byKey = new Map<string, { id: string; usageCount: number }[]>()
  for (const item of items) {
    const key = duplicateKey(item.name)
    if (!key) continue
    byKey.set(key, [...(byKey.get(key) ?? []), item])
  }
  const skip = new Set(ignored)
  return [...byKey.values()]
    .filter((members) => members.length > 1)
    .map((members) => {
      const ids = [...members].sort((a, b) => b.usageCount - a.usageCount).map((m) => m.id)
      return { key: ignoreKey(ids), ids, targetId: ids[0]! }
    })
    .filter((group) => !skip.has(group.key))
}

/**
 * Jednotky, ktoré sa pri zlúčení nedajú prepočítať (napr. g a ks); prázdne pole = v poriadku (g a kg áno).
 * Vstup: jednotky použité pri každej zlučovanej ingrediencii.
 */
export function mixedUnits(units: readonly (readonly (UnitCode | null)[])[]): UnitCode[] {
  const all = [...new Set(units.flat().filter((u): u is UnitCode => u !== null))]
  const bases = new Set(all.map((u) => toBase(1, u).unit))
  return bases.size > 1 ? all.sort() : []
}
