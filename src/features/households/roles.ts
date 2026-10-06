import type { HouseholdRole } from '@shared/family'
import { t } from '@/i18n'

export const HOUSEHOLD_ROLES: readonly HouseholdRole[] = ['owner', 'member']

/** Názov roly v aktuálnom jazyku (číta reaktívny jazyk, takže sa v šablónach prekreslí pri jeho zmene). */
export const roleLabel = (role: HouseholdRole): string => t(`common.role.${role}`)
