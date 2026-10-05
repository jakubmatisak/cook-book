import { normalizeText } from '@shared/text'

/** Zhoda pre vyhľadávanie v zoznamoch (napr. autocomplete): bez diakritiky a veľkosti písmen. */
export function matchesSearch(value: string, query: string | null | undefined): boolean {
  const needle = normalizeText(query ?? '')
  return !needle || normalizeText(value).includes(needle)
}
