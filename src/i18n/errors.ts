import { ApiError } from '@/api/http'
import { currentLocale, t, te } from './index'

/**
 * Text chyby pre používateľa. Chyby API majú stabilný `code`: v slovenčine sa ukáže (podrobnejšia) hláška servera,
 * v iných jazykoch preklad podľa kódu a až potom hláška servera. Iné chyby dostanú všeobecný text.
 */
export function errorText(error: unknown, fallbackKey = 'common.errors.generic'): string {
  if (error instanceof ApiError) {
    const key = `common.errors.${error.code}`
    if (currentLocale() !== 'sk' && te(key)) return t(key)
    return error.message || (te(key) ? t(key) : t(fallbackKey))
  }
  if (error instanceof Error && error.message) return error.message
  return t(fallbackKey)
}
