import { mdiChefHat, mdiClockOutline, mdiPotSteamOutline, mdiSilverwareForkKnife } from '@mdi/js'
import { computed, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RecipeDetailDto } from '@shared/api'
import { formatMinutes, tc } from '@/i18n/format'

export interface RecipeChip {
  icon?: string
  text: string
  color?: string
}

type ChipSource = Pick<
  RecipeDetailDto,
  'category' | 'prepMinutes' | 'cookMinutes' | 'servings' | 'difficulty'
>

/** Štítky pod nadpisom receptu na čítanie: typ jedla, príprava, varenie, porcie, náročnosť. */
export function useRecipeChips(recipe: Ref<ChipSource | undefined>): ComputedRef<RecipeChip[]> {
  const { t } = useI18n()
  return computed(() => {
    const r = recipe.value
    if (!r) return []
    const list: RecipeChip[] = [{ text: t(`common.category.${r.category}`), color: 'primary' }]
    if (r.prepMinutes !== null)
      list.push({
        icon: mdiClockOutline,
        text: t('recipes.detail.prep', { time: formatMinutes(r.prepMinutes) }),
      })
    if (r.cookMinutes !== null)
      list.push({
        icon: mdiPotSteamOutline,
        text: t('recipes.detail.cook', { time: formatMinutes(r.cookMinutes) }),
      })
    list.push({ icon: mdiSilverwareForkKnife, text: tc('common.plural.portions', r.servings) })
    list.push({ icon: mdiChefHat, text: t(`common.difficulty.${r.difficulty}`) })
    return list
  })
}
