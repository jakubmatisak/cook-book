<script setup lang="ts">
import { mdiBookOpenPageVariantOutline, mdiHeart, mdiPlus } from '@mdi/js'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RECIPE_CATEGORIES } from '@shared/recipes'
import { useRecipes } from '@/api/recipes'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useKidsEnabled } from '@/composables/useKidsEnabled'
import { errorText } from '@/i18n/errors'
import { tc } from '@/i18n/format'
import { CATEGORY_ICONS } from '../categoryIcons'

const { t } = useI18n()
const kidsEnabled = useKidsEnabled()
// Detské recepty sa v počtoch „všetkých“ a „obľúbených“ nerátajú, majú vlastnú dlaždicu.
const { data: list, isPending, error } = useRecipes(() => ({ kids: 'include' }))

const items = computed(() => list.value?.items ?? [])
const regular = computed(() => items.value.filter((r) => r.category !== 'detske'))

interface Tile {
  key: string
  title: string
  count: number
  icon: string
  to: { path: string; query: Record<string, string> }
  color?: string
}

const tiles = computed<Tile[]>(() => {
  const counts = list.value?.facets.category ?? {}
  const categories: Tile[] = RECIPE_CATEGORIES.filter(
    (c) => (counts[c] ?? 0) > 0 && (kidsEnabled.value || c !== 'detske'),
  ).map((c) => ({
    key: c,
    title: t(`common.category.${c}`),
    count: counts[c] ?? 0,
    icon: CATEGORY_ICONS[c],
    to: { path: '/recepty', query: { kategoria: c } },
  }))
  return [
    {
      key: 'all',
      title: t('home.all'),
      count: regular.value.length,
      icon: mdiBookOpenPageVariantOutline,
      to: { path: '/recepty', query: {} },
      color: 'primary',
    },
    {
      key: 'favorites',
      title: t('home.favorites'),
      count: regular.value.filter((r) => r.isFavorite).length,
      icon: mdiHeart,
      to: { path: '/recepty', query: { oblubene: '1' } },
      color: 'primary',
    },
    ...categories,
  ]
})
</script>

<template>
  <PageHeader :title="t('home.title')" :subtitle="t('home.subtitle')" />

  <v-alert v-if="error" type="error" :text="errorText(error)" />
  <v-row v-else-if="isPending">
    <v-col v-for="n in 8" :key="n" cols="6" sm="4" lg="3">
      <v-skeleton-loader type="card" />
    </v-col>
  </v-row>
  <EmptyState
    v-else-if="!items.length"
    :icon="mdiBookOpenPageVariantOutline"
    :title="t('home.emptyTitle')"
    :text="t('home.emptyText')"
    data-test="home-empty"
  >
    <v-btn color="primary" :prepend-icon="mdiPlus" to="/recepty/novy">{{ t('home.addFirst') }}</v-btn>
  </EmptyState>
  <v-row v-else data-test="home-tiles">
    <v-col v-for="tile in tiles" :key="tile.key" cols="6" sm="4" lg="3">
      <v-card
        :to="tile.to"
        class="h-100 d-flex flex-column align-center justify-center text-center pa-4"
        :data-test="`tile-${tile.key}`"
      >
        <v-icon :icon="tile.icon" size="40" :color="tile.color ?? 'primary'" class="mb-2" />
        <div class="text-subtitle-1 font-weight-bold">{{ tile.title }}</div>
        <div class="text-body-2 text-medium-emphasis">{{ tc('common.plural.recipes', tile.count) }}</div>
      </v-card>
    </v-col>
  </v-row>
</template>
