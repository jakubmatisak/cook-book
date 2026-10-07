<script setup lang="ts">
import { mdiClose } from '@mdi/js'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TagDto } from '@shared/api'
import { TIME_BUCKETS, type RecipeFacets } from '@shared/recipeFacets'
import { RECIPE_CATEGORIES } from '@shared/recipes'
import { useKidsEnabled } from '@/composables/useKidsEnabled'
import { activeFilterCount, type FilterDimension, type RecipeListState } from '../listQuery'

const { t } = useI18n()
const kidsEnabled = useKidsEnabled()
// Pri vypnutých detských jedlách sa kategória Detské v ponuke nezobrazí.
const categories = computed(() => RECIPE_CATEGORIES.filter((c) => kidsEnabled.value || c !== 'detske'))
const props = defineProps<{
  state: RecipeListState
  facets: RecipeFacets
  tags: TagDto[]
  resultCount: number
}>()
const emit = defineEmits<{
  toggle: [dimension: FilterDimension, value: string | number]
  clear: []
  close: []
}>()

interface Option {
  value: string | number
  label: string
  count: number
  selected: boolean
}
interface Section {
  key: FilterDimension
  title: string
  options: Option[]
  selected: number
}

const section = (
  key: FilterDimension,
  title: string,
  selectedValues: readonly (string | number)[],
  options: { value: string | number; label: string; count: number | undefined }[],
): Section => ({
  key,
  title,
  selected: selectedValues.length,
  options: options.map((o) => ({
    value: o.value,
    label: o.label,
    count: o.count ?? 0,
    selected: selectedValues.includes(o.value),
  })),
})

const sections = computed<Section[]>(() => {
  const { state, facets } = props
  return [
    section(
      'category',
      t('recipes.filters.category'),
      state.category,
      categories.value.map((c) => ({
        value: c,
        label: t(`common.category.${c}`),
        count: facets.category[c],
      })),
    ),
    section(
      'time',
      t('recipes.filters.time'),
      state.time,
      TIME_BUCKETS.map((b) => ({ value: b, label: t(`common.timeBucket.${b}`), count: facets.time[b] })),
    ),
    section(
      'difficulty',
      t('recipes.filters.difficulty'),
      state.difficulty,
      ([1, 2, 3] as const).map((d) => ({
        value: d,
        label: t(`common.difficulty.${d}`),
        count: facets.difficulty[d],
      })),
    ),
    section(
      'tag',
      t('recipes.filters.tags'),
      state.tag,
      props.tags.map((tag) => ({ value: tag.id, label: tag.name, count: facets.tag[tag.id] })),
    ),
  ].filter((s) => s.options.length > 0)
})

const open = ref<FilterDimension[]>(['category', 'time', 'difficulty', 'tag'])
const total = computed(() => activeFilterCount(props.state))
</script>

<template>
  <v-card :border="false" rounded="0" class="h-100 d-flex flex-column">
    <v-toolbar density="compact" color="transparent">
      <v-toolbar-title class="font-weight-bold">
        {{ t('recipes.filters.title') }}<span v-if="total"> ({{ total }})</span>
      </v-toolbar-title>
      <v-btn
        :icon="mdiClose"
        variant="text"
        :aria-label="t('recipes.filters.close')"
        @click="emit('close')"
      />
    </v-toolbar>
    <v-divider />

    <v-card-text class="flex-grow-1 overflow-y-auto pa-0">
      <div v-if="$slots.top" class="d-flex flex-column ga-3 pa-4" data-test="filter-quick">
        <slot name="top" />
      </div>
      <v-expansion-panels v-model="open" variant="accordion" multiple flat>
        <v-expansion-panel v-for="s in sections" :key="s.key" :value="s.key" :data-test="`filter-${s.key}`">
          <v-expansion-panel-title class="font-weight-bold">
            {{ s.title }}
            <v-chip v-if="s.selected" size="x-small" color="primary" class="ms-2">{{ s.selected }}</v-chip>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-list density="compact" class="pa-0">
              <v-list-item
                v-for="o in s.options"
                :key="o.value"
                :disabled="o.count === 0 && !o.selected"
                @click="emit('toggle', s.key, o.value)"
              >
                <template #prepend>
                  <v-checkbox-btn
                    :model-value="o.selected"
                    color="primary"
                    :disabled="o.count === 0 && !o.selected"
                    :aria-label="o.label"
                    @click.stop
                    @update:model-value="emit('toggle', s.key, o.value)"
                  />
                </template>
                <v-list-item-title>{{ o.label }}</v-list-item-title>
                <template #append>
                  <v-chip size="x-small" variant="tonal">{{ o.count }}</v-chip>
                </template>
              </v-list-item>
            </v-list>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>

    <v-divider />
    <v-card-actions class="pa-3 ga-2">
      <v-btn variant="text" :disabled="total === 0" @click="emit('clear')">{{
        t('recipes.filters.clear')
      }}</v-btn>
      <v-spacer />
      <v-btn color="primary" variant="flat" @click="emit('close')">{{
        t('recipes.filters.show', { n: resultCount })
      }}</v-btn>
    </v-card-actions>
  </v-card>
</template>
