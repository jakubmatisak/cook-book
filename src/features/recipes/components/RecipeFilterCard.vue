<script setup lang="ts">
import { mdiClose } from '@mdi/js'
import { computed, ref } from 'vue'
import type { TagDto } from '@shared/api'
import { TIME_BUCKET_LABELS, TIME_BUCKETS, type RecipeFacets } from '@shared/recipeFacets'
import { DIFFICULTY_LABELS, RECIPE_CATEGORIES, RECIPE_CATEGORY_LABELS } from '@shared/recipes'
import { activeFilterCount, type FilterDimension, type RecipeListState } from '../listQuery'

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
      'Kategória',
      state.category,
      RECIPE_CATEGORIES.map((c) => ({
        value: c,
        label: RECIPE_CATEGORY_LABELS[c],
        count: facets.category[c],
      })),
    ),
    section(
      'time',
      'Čas prípravy',
      state.time,
      TIME_BUCKETS.map((b) => ({ value: b, label: TIME_BUCKET_LABELS[b], count: facets.time[b] })),
    ),
    section(
      'difficulty',
      'Náročnosť',
      state.difficulty,
      ([1, 2, 3] as const).map((d) => ({
        value: d,
        label: DIFFICULTY_LABELS[d],
        count: facets.difficulty[d],
      })),
    ),
    section(
      'tag',
      'Tagy',
      state.tag,
      props.tags.map((t) => ({ value: t.id, label: t.name, count: facets.tag[t.id] })),
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
        Filtre<span v-if="total"> ({{ total }})</span>
      </v-toolbar-title>
      <v-btn :icon="mdiClose" variant="text" aria-label="Zavrieť filtre" @click="emit('close')" />
    </v-toolbar>
    <v-divider />

    <v-card-text class="flex-grow-1 overflow-y-auto pa-0">
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
      <v-btn variant="text" :disabled="total === 0" @click="emit('clear')">Zrušiť filtre</v-btn>
      <v-spacer />
      <v-btn color="primary" variant="flat" @click="emit('close')">Zobraziť {{ resultCount }}</v-btn>
    </v-card-actions>
  </v-card>
</template>
