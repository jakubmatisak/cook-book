export const MEMBER_KINDS = ['adult', 'child'] as const
export type MemberKind = (typeof MEMBER_KINDS)[number]

export const MEMBER_KIND_LABELS: Record<MemberKind, string> = { adult: 'Dospelý', child: 'Dieťa' }

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
