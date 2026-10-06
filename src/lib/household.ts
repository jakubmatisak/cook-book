import { shallowRef } from 'vue'
import type { HouseholdSummaryDto } from '@shared/api'

const ACTIVE_KEY = 'kniha:household'
const LAST_KEY = 'kniha:last-household'

const read = (storage: () => Storage, key: string): string | null => {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}

const write = (storage: () => Storage, key: string, value: string | null) => {
  try {
    if (value === null) storage().removeItem(key)
    else storage().setItem(key, value)
  } catch {
    // súkromné okno a pod. – výber ostane len v pamäti stránky
  }
}

/** Domácnosť zvolená v tomto okne prehliadača (dve karty môžu mať dve rôzne domácnosti). */
export const activeHouseholdId = (): string | null => read(() => sessionStorage, ACTIVE_KEY)

/** Naposledy použitá domácnosť na tomto zariadení; ponúka sa pri výbere. */
export const lastHouseholdId = (): string | null => read(() => localStorage, LAST_KEY)

/** Reaktívne zrkadlo aktívnej domácnosti pre UI (prepínač v hlavičke). */
export const activeHousehold = shallowRef<string | null>(activeHouseholdId())

export function setActiveHousehold(id: string): void {
  write(() => sessionStorage, ACTIVE_KEY, id)
  write(() => localStorage, LAST_KEY, id)
  activeHousehold.value = id
}

export function clearActiveHousehold(): void {
  write(() => sessionStorage, ACTIVE_KEY, null)
  activeHousehold.value = null
}

export type HouseholdChoice =
  { kind: 'ready'; id: string } | { kind: 'pick'; preferred: string | null } | { kind: 'none' }

/**
 * Rozhodne, či sa dá rovno vojsť: platná zvolená domácnosť alebo jediná domácnosť používateľa;
 * pri viacerých bez platnej voľby sa žiada výber (s naposledy použitou ako predvoľbou).
 */
export function resolveHousehold(
  households: readonly Pick<HouseholdSummaryDto, 'id'>[],
  active: string | null,
  last: string | null,
): HouseholdChoice {
  if (households.length === 0) return { kind: 'none' }
  if (active && households.some((h) => h.id === active)) return { kind: 'ready', id: active }
  if (households.length === 1) return { kind: 'ready', id: households[0]!.id }
  return { kind: 'pick', preferred: last && households.some((h) => h.id === last) ? last : null }
}
