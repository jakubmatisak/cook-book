import type { RouterScrollBehavior } from 'vue-router'

/**
 * Nová stránka ide na začiatok, návrat späť obnoví polohu. Zmena len query parametrov (filtre, porcie, týždeň)
 * nechá stránku tam, kde je, aby používateľa nehádzalo hore.
 */
export const scrollOnNavigate: RouterScrollBehavior = (to, from, saved) =>
  saved ?? (to.path === from.path ? false : { top: 0 })
