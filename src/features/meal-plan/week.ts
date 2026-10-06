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

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number) as [number, number]
  return h * 60 + m
}

/**
 * Jedlo dňa, do ktorého sa hodí zaradiť recept „teraz“: najbližšie zapnuté jedlo, ktoré ešte nezačalo;
 * po poslednom jedle dňa posledné zapnuté. Jedlá bez času berú prvé zapnuté.
 */
export function pickSlotForNow(slots: readonly MealSlotDto[], nowMinutes: number): MealSlotDto | undefined {
  const enabled = slots.filter((s) => s.isEnabled).sort((a, b) => a.sortOrder - b.sortOrder)
  if (enabled.length === 0) return undefined
  const timed = enabled.filter((s) => s.defaultTime)
  if (timed.length === 0) return enabled[0]
  return timed.find((s) => toMinutes(s.defaultTime!) >= nowMinutes) ?? enabled[enabled.length - 1]
}

/** Najmenšia šírka týždennej mriežky bez vodorovného posuvníka: popisy riadkov 7 rem + 7 dní po 8 rem. */
export const GRID_MIN_WIDTH = (7 + 7 * 8) * 16

/** Mriežka sa ukáže, len keď sa zmestí; užšie plochy dostanú zoznam po dňoch (bez posuvníka). */
export const gridFits = (width: number): boolean => width >= GRID_MIN_WIDTH
