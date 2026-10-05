/** Text na porovnávanie a vyhľadávanie: bez diakritiky, malé písmená, jedna medzera. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const MAX_SLUG = 80

/** URL slug z ľubovoľného textu, napr. „Hovädzí guláš“ → `hovadzi-gulas`. */
export function slugify(value: string): string {
  const slug = normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/, '')
  return slug || 'recept'
}
