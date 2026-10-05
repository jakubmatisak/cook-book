import type { GenerateResult } from '@shared/api'
import { daysBetween } from '@shared/dates'
import { plural } from '@/lib/format'

export type ExpiryStatus = 'none' | 'expired' | 'soon' | 'ok'

const days = (n: number) => plural(n, 'deň', 'dni', 'dní')

/** Stav trvanlivosti k dnešku: po dátume, najbližších `soonDays` dní, v poriadku alebo bez dátumu. */
export function expiryStatus(expiresOn: string | null, today: string, soonDays = 3): ExpiryStatus {
  if (!expiresOn) return 'none'
  const left = daysBetween(today, expiresOn)
  if (left < 0) return 'expired'
  return left <= soonDays ? 'soon' : 'ok'
}

/** „Expiruje zajtra“, „Po trvanlivosti 3 dni“; bez dátumu prázdny text. */
export function describeExpiry(expiresOn: string | null, today: string): string {
  if (!expiresOn) return ''
  const left = daysBetween(today, expiresOn)
  if (left < 0) return `Po trvanlivosti ${days(-left)}`
  if (left === 0) return 'Expiruje dnes'
  if (left === 1) return 'Expiruje zajtra'
  return `Expiruje o ${days(left)}`
}

/** „Každý týždeň“, „Každé 2 týždne“, „Každých 6 týždňov“. */
export function describeCadence(everyNWeeks: number): string {
  if (everyNWeeks <= 1) return 'Každý týždeň'
  if (everyNWeeks <= 4) return `Každé ${everyNWeeks} týždne`
  return `Každých ${everyNWeeks} týždňov`
}

const added = (n: number) =>
  `${n === 1 ? 'Pridaná' : n <= 4 ? 'Pridané' : 'Pridaných'} ${plural(n, 'položka', 'položky', 'položiek')}`
const staplesLabel = (n: number) => `${n} ${n === 1 ? 'stála' : n <= 4 ? 'stále' : 'stálych'}`

/** Veta po vygenerovaní nákupu: čo pribudlo a čo urobila špajza a stále položky. */
export function summarizeGenerate(result: GenerateResult): string {
  const parts: string[] = []
  if (result.added === 0) parts.push('Nič nové na nákup.')
  else if (result.staples > 0) parts.push(`${added(result.added)}, z toho ${staplesLabel(result.staples)}.`)
  else parts.push(`${added(result.added)}.`)

  // Názvy sa vymenujú, aby si nakupujúci mohol overiť, čo zo zoznamu zmizlo kvôli špajzi.
  const names = (list: readonly string[]) => `${list.slice(0, 4).join(', ')}${list.length > 4 ? '…' : ''}`
  const covered = result.covered
  const reduced = result.reduced
  const coveredText = `Špajza pokryla ${plural(covered.length, 'položku', 'položky', 'položiek')} (${names(covered)})`
  if (covered.length > 0 && reduced.length > 0) {
    parts.push(`${coveredText} a znížila množstvo: ${names(reduced)}.`)
  } else if (covered.length > 0) {
    parts.push(`${coveredText}.`)
  } else if (reduced.length > 0) {
    parts.push(`Špajza znížila množstvo: ${names(reduced)}.`)
  }
  if (result.kept > 0) parts.push(`Ponechané kúpené: ${result.kept}.`)
  return parts.join(' ')
}
