import type { RecipeCategory } from '@shared/recipes'
import type { ShareKind, ShareStatus } from '@shared/sharing'
import { t } from '@/i18n'
import { tc } from '@/i18n/format'

/** Čo ponuka zdieľa: „2 recepty“, „Kategória Dezert“, „Tag Vianoce“. */
export function shareWhat(share: {
  kind: ShareKind
  category: RecipeCategory | null
  tagName: string | null
  recipes: unknown[]
}): string {
  if (share.kind === 'category')
    return t('sharing.what.category', { name: share.category ? t(`common.category.${share.category}`) : '' })
  if (share.kind === 'tag') return t('sharing.what.tag', { name: share.tagName ?? '' })
  return tc('sharing.what.recipes', share.recipes.length)
}

/** Farba čipu stavu ponuky (z témy). */
export const STATUS_COLORS: Readonly<Record<ShareStatus, string>> = {
  pending: 'warning',
  accepted: 'success',
  declined: 'error',
  revoked: 'secondary',
}
