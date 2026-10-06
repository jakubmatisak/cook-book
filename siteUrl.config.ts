import type { Plugin } from 'vite'

/**
 * Dosadí adresu nasadenej stránky do značiek náhľadu (`%SITE_URL%` v index.html), lebo obrázok pre Open Graph
 * musí mať úplnú adresu. Adresa sa nastavuje pri zostavení (`SITE_URL` alebo `VITE_SITE_URL`), do repozitára
 * sa nedáva; bez nej ostane relatívna cesta.
 */
export function siteUrlPlugin(siteUrl: string | undefined): Plugin {
  const base = (siteUrl ?? '').trim().replace(/\/+$/, '')
  return {
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', base),
  }
}
