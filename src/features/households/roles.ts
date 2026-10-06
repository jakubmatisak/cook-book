import type { HouseholdRole } from '@shared/family'

export const ROLE_LABELS: Record<HouseholdRole, string> = {
  owner: 'Vlastník',
  member: 'Člen',
}

export const roleLabel = (role: HouseholdRole): string => ROLE_LABELS[role]
