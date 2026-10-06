import type { GenerateResult } from '@shared/api'
import { daysBetween } from '@shared/dates'
import { currentLocale, t } from '@/i18n'
import { tc } from '@/i18n/format'

export type ExpiryStatus = 'none' | 'expired' | 'soon' | 'ok'

const days = (n: number) => tc('common.plural.days', n)

/** Stav trvanlivosti k dnešku: po dátume, najbližších `soonDays` dní, v poriadku alebo bez dátumu. */
export function expiryStatus(expiresOn: string | null, today: string, soonDays = 3): ExpiryStatus {
  if (!expiresOn) return 'none'
  const left = daysBetween(today, expiresOn)
  if (left < 0) return 'expired'
  return left <= soonDays ? 'soon' : 'ok'
}

/** „Trvanlivosť končí zajtra“, „Po trvanlivosti 3 dni“; bez dátumu prázdny text. */
export function describeExpiry(expiresOn: string | null, today: string): string {
  if (!expiresOn) return ''
  const left = daysBetween(today, expiresOn)
  if (left < 0) return t('pantry.expiry.past', { days: days(-left) })
  if (left === 0) return t('pantry.expiry.today')
  if (left === 1) return t('pantry.expiry.tomorrow')
  return t('pantry.expiry.in', { days: days(left) })
}

/** „Každý týždeň“, „Každé 2 týždne“, „Každých 6 týždňov“. */
export const describeCadence = (everyNWeeks: number): string => tc('pantry.cadence', Math.max(1, everyNWeeks))

/** Množstvo do textového poľa: v slovenčine s desatinnou čiarkou, inak s bodkou. */
export const quantityInputText = (quantity: number | null | undefined): string => {
  if (quantity == null) return ''
  const text = String(quantity)
  return currentLocale() === 'sk' ? text.replace('.', ',') : text
}

/** Veta po vygenerovaní nákupu: čo pribudlo a čo urobila špajza a stále položky. */
export function summarizeGenerate(result: GenerateResult): string {
  const parts: string[] = []
  const added = tc('pantry.generate.added', result.added)
  if (result.added === 0) parts.push(t('pantry.generate.nothingNew'))
  else if (result.staples > 0)
    parts.push(
      t('pantry.generate.addedWithStaples', {
        added,
        staples: tc('pantry.generate.staples', result.staples),
      }),
    )
  else parts.push(t('pantry.generate.addedOnly', { added }))

  // Názvy sa vymenujú, aby si nakupujúci mohol overiť, čo zo zoznamu zmizlo kvôli špajzi.
  const names = (list: readonly string[]) => `${list.slice(0, 4).join(', ')}${list.length > 4 ? '…' : ''}`
  const covered = result.covered
  const reduced = result.reduced
  const coveredText = tc('pantry.generate.covered', covered.length, { names: names(covered) })
  if (covered.length > 0 && reduced.length > 0) {
    parts.push(t('pantry.generate.coveredAndReduced', { covered: coveredText, names: names(reduced) }))
  } else if (covered.length > 0) {
    parts.push(t('pantry.generate.coveredOnly', { covered: coveredText }))
  } else if (reduced.length > 0) {
    parts.push(t('pantry.generate.reducedOnly', { names: names(reduced) }))
  }
  if (result.kept > 0) parts.push(t('pantry.generate.kept', { n: result.kept }))
  return parts.join(' ')
}
