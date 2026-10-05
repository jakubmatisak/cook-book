import type { MemberKind, PlanAudience } from './family'

export interface PortionMember {
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
  entry: { servingsOverride: number | null; audience: PlanAudience },
  members: readonly PortionMember[],
): number | null {
  if (entry.servingsOverride !== null) return entry.servingsOverride
  const eating = members.filter(
    (m) =>
      m.isActive &&
      (entry.audience === 'adults'
        ? m.kind === 'adult'
        : entry.audience === 'children'
          ? m.kind === 'child'
          : true),
  )
  if (eating.length === 0) return null
  return roundQuarter(eating.reduce((sum, m) => sum + m.portionFactor, 0))
}
