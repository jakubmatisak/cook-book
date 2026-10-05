import type { MealSlotDto, PlanEntryDto } from '@shared/api'
import { isIsoDate, startOfWeek } from '@shared/dates'

/** Začiatok zobrazeného týždňa: dátum z URL zarovnaný na začiatok týždňa, inak aktuálny týždeň. */
export function resolveWeekStart(query: string | undefined, weekStartsOn: number, today: string): string {
  return startOfWeek(query && isIsoDate(query) ? query : today, weekStartsOn)
}

/** Zapnuté jedlá dňa + vypnuté, ak je v nich v danom týždni niečo naplánované. */
export function visibleSlots(slots: readonly MealSlotDto[], entries: readonly PlanEntryDto[]): MealSlotDto[] {
  const used = new Set(entries.map((e) => e.slotId))
  return slots.filter((s) => s.isEnabled || used.has(s.id)).sort((a, b) => a.sortOrder - b.sortOrder)
}

export const cellKey = (date: string, slotId: string) => `${date}|${slotId}`

export function groupEntries(entries: readonly PlanEntryDto[]): Map<string, PlanEntryDto[]> {
  const groups = new Map<string, PlanEntryDto[]>()
  for (const e of entries) {
    const key = cellKey(e.date, e.slotId)
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  return groups
}
