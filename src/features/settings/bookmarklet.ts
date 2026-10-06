/**
 * Záložka („bookmarklet“) na pridanie receptu: po kliknutí na stránke s receptom otvorí v novej karte import
 * do tejto aplikácie s adresou práve otvorenej stránky. Nepotrebuje inštaláciu ani rozšírenie.
 */
export function importBookmarklet(origin: string): string {
  const target = `${origin.replace(/\/+$/, '')}/recepty/import?url=`
  return `javascript:(function(){window.open(${JSON.stringify(target)}+encodeURIComponent(location.href),'_blank')})()`
}
