import type { MealSlotDto, PlanEntryDto } from '@shared/api'
import type { PlanEntryInputRaw } from '@shared/schemas/plan'
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

/** Vstup uloženia pre ten istý záznam na inom dni alebo jedle dňa (presun alebo kópia). */
export function entryToInput(entry: PlanEntryDto, date: string, slotId: string): PlanEntryInputRaw {
  return {
    date,
    slotId,
    recipeId: entry.recipeId,
    freeText: entry.freeText,
    servingsOverride: entry.servingsOverride,
    note: entry.note,
  }
}

/** Cieľ presunu, alebo null, keď sa záznam pustil na pôvodné miesto. */
export function moveTarget(
  entry: PlanEntryDto,
  date: string,
  slotId: string,
): { date: string; slotId: string } | null {
  return entry.date === date && entry.slotId === slotId ? null : { date, slotId }
}
