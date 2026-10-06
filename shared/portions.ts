import type { MemberKind, PlanAudience } from './family'

export interface PortionMember {
  /** Potrebné len pre návštevy (vyberajú sa podľa ID). */
  id?: string
  kind: MemberKind
  portionFactor: number
  isActive: boolean
}

const roundQuarter = (n: number) => Math.round(n * 4) / 4

/**
 * Koľko porcií sa varí pre záznam plánu: ručne zadané číslo, inak súčet koeficientov
 * aktívnych členov podľa cieľovej skupiny. Bez členov `null` (použijú sa porcie receptu).
 */
export function entryPortions(
  entry: { servingsOverride: number | null; audience: PlanAudience; guestIds?: readonly string[] },
  members: readonly PortionMember[],
): number | null {
  if (entry.servingsOverride !== null) return entry.servingsOverride
  const eating = members.filter((m) => {
    if (!m.isActive) return false
    // Návšteva je pri jedle len vtedy, keď je vybraná, bez ohľadu na cieľovú skupinu.
    if (m.kind === 'guest') return m.id !== undefined && (entry.guestIds ?? []).includes(m.id)
    return entry.audience === 'adults'
      ? m.kind === 'adult'
      : entry.audience === 'children'
        ? m.kind === 'child'
        : true
  })
  if (eating.length === 0) return null
  return roundQuarter(eating.reduce((sum, m) => sum + m.portionFactor, 0))
}
