<script setup lang="ts">
import { mdiCallMerge } from '@mdi/js'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import type { IngredientDto } from '@shared/api'
import { findDuplicateGroups, mixedUnits } from '@shared/ingredientDuplicates'
import { useIgnoreMergeSuggestion, useIngredientUnits, useMergeIgnored } from '@/api/ingredientMerge'
import { tc } from '@/i18n/format'

/**
 * Návrhy na zlúčenie: ingrediencie, ktoré sa líšia len tvarom slov či poradím (Paradajka – Paradajky). Počítajú sa
 * vždy z aktuálneho zoznamu, takže nové duplicity z ďalších receptov sa ukážu samy.
 */
const props = defineProps<{ ingredients: IngredientDto[] }>()
const emit = defineEmits<{ merge: [items: IngredientDto[]] }>()
const { t } = useI18n()
const { xs } = useDisplay()
const { data: ignored } = useMergeIgnored()
const ignore = useIgnoreMergeSuggestion()

const byId = computed(() => new Map(props.ingredients.map((i) => [i.id, i])))
const groups = computed(() =>
  ignored.value
    ? findDuplicateGroups(props.ingredients, ignored.value).map((g) => ({
        ...g,
        items: g.ids.flatMap((id) => byId.value.get(id) ?? []),
      }))
    : [],
)
// Jednotky navrhnutých ingrediencií: pri rozdielnych (g a ks) červený štítok, nech je jasné, čo s čím zlúčiť.
const { data: units } = useIngredientUnits(
  () => groups.value.flatMap((g) => g.ids),
  () => groups.value.length > 0,
)
const unitsOf = (item: IngredientDto) => [
  ...new Set([...(units.value?.[item.id] ?? []), ...(item.defaultUnit ? [item.defaultUnit] : [])]),
]
const isMixed = (items: IngredientDto[]) => mixedUnits(items.map(unitsOf)).length > 0
const label = (item: IngredientDto) => {
  const details = [
    ...(item.usageCount ? [tc('ingredients.usedIn', item.usageCount)] : []),
    ...(unitsOf(item).length ? [unitsOf(item).join(', ')] : []),
  ]
  return details.length ? `${item.name} (${details.join(', ')})` : item.name
}
</script>

<template>
  <v-expansion-panels v-if="groups.length" class="mb-4" data-test="merge-suggestions">
    <v-expansion-panel>
      <v-expansion-panel-title>
        <div class="d-flex align-center ga-3">
          <v-icon :icon="mdiCallMerge" color="primary" />
          <span class="font-weight-medium">{{
            t('ingredients.suggestions.title', { n: groups.length })
          }}</span>
        </div>
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <p class="text-body-medium text-medium-emphasis mb-2">{{ t('ingredients.suggestions.text') }}</p>
        <v-list density="compact" class="pa-0" bg-color="transparent">
          <template v-for="(group, index) in groups" :key="group.key">
            <v-divider v-if="index > 0" />
            <v-list-item class="px-0" data-test="merge-suggestion">
              <!-- Na mobile (pod 600 px) sú akcie pod textom, inak vpravo vedľa neho. -->
              <div class="d-flex flex-column flex-sm-row align-sm-center ga-2">
                <v-list-item-title class="text-wrap flex-grow-1">
                  {{ group.items.map(label).join(' · ') }}
                  <v-chip
                    v-if="isMixed(group.items)"
                    color="error"
                    variant="tonal"
                    size="x-small"
                    class="ms-1"
                    data-test="suggestion-mixed-units"
                  >
                    {{ t('ingredients.suggestions.mixedUnits') }}
                  </v-chip>
                </v-list-item-title>
                <div
                  class="d-flex ga-2 flex-shrink-0"
                  :data-test="xs ? 'suggestion-actions-below' : 'suggestion-actions'"
                >
                  <v-btn
                    color="primary"
                    variant="tonal"
                    :size="xs ? 'default' : 'small'"
                    :class="{ 'flex-grow-1': xs }"
                    data-test="suggestion-merge"
                    @click="emit('merge', group.items)"
                  >
                    {{ t('ingredients.suggestions.merge') }}
                  </v-btn>
                  <v-btn
                    variant="outlined"
                    :size="xs ? 'default' : 'small'"
                    :class="{ 'flex-grow-1': xs }"
                    :loading="ignore.isPending.value"
                    data-test="suggestion-ignore"
                    @click="ignore.mutate(group.ids)"
                  >
                    {{ t('ingredients.suggestions.ignore') }}
                  </v-btn>
                </div>
              </div>
            </v-list-item>
          </template>
        </v-list>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>
