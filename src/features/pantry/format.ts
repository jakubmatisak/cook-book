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

  const covered = result.coveredByPantry
  const reduced = result.reducedByPantry
  if (covered > 0 && reduced > 0) {
    parts.push(
      `Špajza pokryla ${plural(covered, 'položku', 'položky', 'položiek')} a znížila množstvo pri ${reduced}.`,
    )
  } else if (covered > 0) {
    parts.push(`Špajza pokryla ${plural(covered, 'položku', 'položky', 'položiek')}.`)
  } else if (reduced > 0) {
    parts.push(`Špajza znížila množstvo pri ${reduced}.`)
  }
  if (result.kept > 0) parts.push(`Ponechané kúpené: ${result.kept}.`)
  return parts.join(' ')
}
