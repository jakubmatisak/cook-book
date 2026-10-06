/**
 * Adresa, ktorú rozšírenie otvorí: `<adresa aplikácie>/recepty/import?url=<adresa stránky>`.
 * Aplikácia musí bežať na https (alebo na localhost pri vývoji). Karty mimo webu (chrome://, nová karta)
 * a chýbajúca adresa aplikácie dajú `null`.
 * @param {string | undefined} appUrl
 * @param {string | undefined} pageUrl
 * @returns {string | null}
 */
export function buildImportUrl(appUrl, pageUrl) {
  const base = String(appUrl ?? '')
    .trim()
    .replace(/\/+$/, '')
  const secure = /^https:\/\/[^/\s]+$/i.test(base)
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base)
  if (!secure && !local) return null

  const page = String(pageUrl ?? '')
  try {
    const { protocol } = new URL(page)
    if (protocol !== 'http:' && protocol !== 'https:') return null
  } catch {
    return null
  }
  return `${base}/recepty/import?url=${encodeURIComponent(page)}`
}
