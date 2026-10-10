<script setup lang="ts">
import { mdiCallMerge } from '@mdi/js'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IngredientDto } from '@shared/api'
import { findDuplicateGroups } from '@shared/ingredientDuplicates'
import { useIgnoreMergeSuggestion, useMergeIgnored } from '@/api/ingredientMerge'
import { tc } from '@/i18n/format'

/**
 * Návrhy na zlúčenie: ingrediencie, ktoré sa líšia len tvarom slov či poradím (Paradajka – Paradajky). Počítajú sa
 * vždy z aktuálneho zoznamu, takže nové duplicity z ďalších receptov sa ukážu samy.
 */
const props = defineProps<{ ingredients: IngredientDto[] }>()
const emit = defineEmits<{ merge: [items: IngredientDto[]] }>()
const { t } = useI18n()
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
const label = (item: IngredientDto) =>
  item.usageCount ? `${item.name} (${tc('ingredients.usedIn', item.usageCount)})` : item.name
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
              <v-list-item-title class="text-wrap">
                {{ group.items.map(label).join(' · ') }}
              </v-list-item-title>
              <template #append>
                <div class="d-flex flex-wrap justify-end ga-1">
                  <v-btn
                    color="primary"
                    variant="tonal"
                    size="small"
                    data-test="suggestion-merge"
                    @click="emit('merge', group.items)"
                  >
                    {{ t('ingredients.suggestions.merge') }}
                  </v-btn>
                  <v-btn
                    variant="text"
                    size="small"
                    :loading="ignore.isPending.value"
                    data-test="suggestion-ignore"
                    @click="ignore.mutate(group.ids)"
                  >
                    {{ t('ingredients.suggestions.ignore') }}
                  </v-btn>
                </div>
              </template>
            </v-list-item>
          </template>
        </v-list>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>
