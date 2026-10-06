import { createI18n } from 'vue-i18n'
import { en as vuetifyEn, sk as vuetifySk } from 'vuetify/locale'
import { z } from '@shared/schemas/zod'
import { LOCALES, type Locale } from '@shared/userSettings'
import { skPluralRule } from './plural'

/**
 * Texty aplikácie: každý súbor v `src/locales/<jazyk>/*.ts` exportuje objekt a jeho názov súboru je predpona
 * kľúčov (`recipes.ts` → `recipes.title`). Rovnaké súbory musia byť v oboch jazykoch (stráži to test).
 */
const loadMessages = (modules: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(modules).map(([path, mod]) => [path.split('/').pop()!.replace(/\.ts$/, ''), mod]),
  )

export const messages = {
  sk: {
    ...loadMessages(import.meta.glob('../locales/sk/*.ts', { eager: true, import: 'default' })),
    $vuetify: vuetifySk,
  },
  en: {
    ...loadMessages(import.meta.glob('../locales/en/*.ts', { eager: true, import: 'default' })),
    $vuetify: vuetifyEn,
  },
}

export const DEFAULT_LOCALE: Locale = 'sk'
const STORAGE_KEY = 'kniha:locale'

export const parseLocale = (raw: string | null | undefined): Locale =>
  (LOCALES as readonly string[]).includes(raw ?? '') ? (raw as Locale) : DEFAULT_LOCALE

function storedLocale(): Locale {
  try {
    return parseLocale(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_LOCALE
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: storedLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages,
  pluralRules: { sk: skPluralRule },
  missingWarn: false,
  fallbackWarn: false,
})

/** Preklad mimo komponentov (hlášky z API, composables). V komponentoch sa používa `useI18n()`. */
export const t = i18n.global.t
export const te = i18n.global.te

export const currentLocale = (): Locale => parseLocale(i18n.global.locale.value)

/** Vstavané hlášky zod (napr. „Neplatná hodnota“) idú v jazyku aplikácie. */
const applyZodLocale = (locale: Locale) => z.config(locale === 'en' ? z.locales.en() : z.locales.sk())
applyZodLocale(currentLocale())

/** Prepne jazyk aplikácie a zapamätá si ho v prehliadači (na server ho ukladá `useSyncUserSettings`). */
export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale
  applyZodLocale(locale)
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // súkromné okno a pod.
  }
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

if (typeof document !== 'undefined') document.documentElement.lang = currentLocale()
