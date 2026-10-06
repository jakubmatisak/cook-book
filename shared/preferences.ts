import type { MemberKind, PlanAudience } from './family'

export const PREFERENCE_KINDS = ['allergy', 'dislike', 'diet'] as const
export type PreferenceKind = (typeof PREFERENCE_KINDS)[number]

/** Jedna preferencia člena: alergia a averzia sa viažu na ingredienciu, diéta na tag receptu. */
export interface MemberPreference {
  kind: PreferenceKind
  ingredientId: string | null
  tagId: string | null
  /** Názov ingrediencie alebo tagu na zobrazenie. */
  label: string
}

export interface PreferenceMember {
  id: string
  name: string
  kind: MemberKind
  isActive: boolean
  preferences: readonly MemberPreference[]
}

export interface PreferenceWarning {
  memberId: string
  memberName: string
  kind: PreferenceKind
  label: string
}

const ORDER: Record<PreferenceKind, number> = { allergy: 0, dislike: 1, diet: 2 }

/**
 * Kto sa jedla týka: aktívni členovia podľa cieľovej skupiny záznamu. Ručný výber členov
 * (`custom`) sa zatiaľ nepoužíva, preto sa berie ako celá rodina.
 */
const eats = (member: PreferenceMember, audience: PlanAudience, guestIds: readonly string[]) => {
  if (!member.isActive) return false
  // Návšteva je pri jedle len vtedy, keď je vybraná.
  if (member.kind === 'guest') return guestIds.includes(member.id)
  return audience === 'adults'
    ? member.kind === 'adult'
    : audience === 'children'
      ? member.kind === 'child'
      : true
}

/**
 * Upozornenia pre recept a členov, ktorí ho budú jesť: alergia a averzia na ingredienciu v recepte,
 * diéta, ktorej recept nezodpovedá (nemá požadovaný tag). Alergie idú prvé. Recepty sa neskrývajú.
 */
export function preferenceConflicts(
  recipe: { ingredientIds: readonly string[]; tagIds: readonly string[] },
  members: readonly PreferenceMember[],
  audience: PlanAudience,
  guestIds: readonly string[] = [],
): PreferenceWarning[] {
  const ingredients = new Set(recipe.ingredientIds)
  const tags = new Set(recipe.tagIds)
  const warnings: PreferenceWarning[] = []
  for (const member of members) {
    if (!eats(member, audience, guestIds)) continue
    const seen = new Set<string>()
    for (const pref of member.preferences) {
      const hit =
        pref.kind === 'diet'
          ? pref.tagId !== null && !tags.has(pref.tagId)
          : pref.ingredientId !== null && ingredients.has(pref.ingredientId)
      const key = `${pref.kind}|${pref.ingredientId ?? pref.tagId}`
      if (!hit || seen.has(key)) continue
      seen.add(key)
      warnings.push({ memberId: member.id, memberName: member.name, kind: pref.kind, label: pref.label })
    }
  }
  // Stabilné zoradenie: druh upozornenia, pri rovnakom druhu poradie členov.
  return warnings
    .map((w, index) => ({ w, index }))
    .sort((a, b) => ORDER[a.w.kind] - ORDER[b.w.kind] || a.index - b.index)
    .map(({ w }) => w)
}

/** Veta upozornenia bez odhadu rodu člena (bez „rád/rada“). */
export function describeWarning(w: PreferenceWarning): string {
  switch (w.kind) {
    case 'allergy':
      return `${w.memberName}: alergia na ${w.label}`
    case 'dislike':
      return `${w.memberName}: averzia na ${w.label}`
    case 'diet':
      return `${w.memberName}: recept nie je „${w.label}“`
  }
}

/** Krátke názvy druhov preferencií (čipy v zozname rodiny). */
export const PREFERENCE_CHIP_LABELS: Readonly<Record<PreferenceKind, string>> = {
  allergy: 'Alergia',
  dislike: 'Averzia',
  diet: 'Diéta',
}
