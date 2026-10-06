/** `guest` = návšteva: nepočíta sa do porcií ani upozornení, kým nie je pri jedle vybraná. */
export const MEMBER_KINDS = ['adult', 'child', 'guest'] as const
export type MemberKind = (typeof MEMBER_KINDS)[number]

export const MEMBER_KIND_LABELS: Record<MemberKind, string> = {
  adult: 'Dospelý',
  child: 'Dieťa',
  guest: 'Návšteva',
}

export const PLAN_AUDIENCES = ['all', 'adults', 'children', 'custom'] as const
export type PlanAudience = (typeof PLAN_AUDIENCES)[number]

export const MEMBER_COLORS = [
  '#B4532A',
  '#5F7A3A',
  '#36677F',
  '#B7791F',
  '#8E4B8C',
  '#C2185B',
  '#00897B',
] as const

/** Rola v domácnosti: vlastník spravuje domácnosť a členov, člen robí všetko okolo varenia. */
export const HOUSEHOLD_ROLES = ['owner', 'member'] as const
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number]
