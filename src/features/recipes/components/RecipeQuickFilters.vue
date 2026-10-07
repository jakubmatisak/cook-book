<script setup lang="ts">
import {
  mdiCheck,
  mdiFridgeOutline,
  mdiHeart,
  mdiSortAscending,
  mdiSortDescending,
  mdiViewGridOutline,
  mdiViewHeadline,
} from '@mdi/js'
import { useI18n } from 'vue-i18n'
import type { SortKey } from '@shared/recipeFacets'
import type { KidsMode, PublicMode, RecipeView } from '../listQuery'

/**
 * Rýchle filtre a zoradenie receptov pod sebou – na mobile sú v paneli Filtre, aby nad zoznamom ostalo len
 * hľadanie. Hodnoty aj zmeny idú cez v-model, stav (adresu) drží stránka receptov.
 */
const { t } = useI18n()
defineProps<{
  kidsEnabled: boolean
  kidsItems: { value: KidsMode; title: string }[]
  publicItems: { value: PublicMode; title: string }[]
  sortItems: { value: SortKey; title: string }[]
  sortDir: 'asc' | 'desc'
  missing: number | 'all'
  canCook: number
  missingOne: number
}>()
const emit = defineEmits<{ 'flip-sort-dir': []; 'update:missing': [value: number | 'all'] }>()
const favorite = defineModel<boolean>('favorite', { required: true })
const kids = defineModel<KidsMode>('kids', { required: true })
const publicMode = defineModel<PublicMode>('publicMode', { required: true })
const pantryMode = defineModel<boolean>('pantryMode', { required: true })
const sortKey = defineModel<SortKey | null>('sortKey', { required: true })
const view = defineModel<RecipeView>('view', { required: true })
</script>

<template>
  <div class="d-flex flex-wrap ga-2">
    <v-btn
      :prepend-icon="favorite ? mdiCheck : mdiHeart"
      :color="favorite ? 'primary' : undefined"
      :variant="favorite ? 'flat' : 'outlined'"
      data-test="favorite-toggle"
      @click="favorite = !favorite"
    >
      {{ t('recipes.list.favorites') }}
    </v-btn>
    <v-btn
      :prepend-icon="pantryMode ? mdiCheck : mdiFridgeOutline"
      :color="pantryMode ? 'primary' : undefined"
      :variant="pantryMode ? 'flat' : 'outlined'"
      data-test="pantry-toggle"
      @click="pantryMode = !pantryMode"
    >
      {{ t('recipes.list.canCook') }}
    </v-btn>
  </div>
  <v-btn-toggle
    v-if="pantryMode"
    :model-value="missing"
    mandatory
    grow
    selected-class="bg-primary"
    class="w-100"
    data-test="missing-toggle"
    @update:model-value="emit('update:missing', $event)"
  >
    <v-btn value="all">{{ t('recipes.list.missingAll') }}</v-btn>
    <v-btn :value="0">{{ t('recipes.list.missingCanCook', { n: canCook }) }}</v-btn>
    <v-btn :value="1">{{ t('recipes.list.missingMaxOne', { n: missingOne }) }}</v-btn>
  </v-btn-toggle>
  <v-select
    v-if="kidsEnabled"
    v-model="kids"
    :items="kidsItems"
    :label="t('recipes.list.kids')"
    hide-details
    data-test="kids-select"
  />
  <v-select
    v-model="publicMode"
    :items="publicItems"
    :label="t('recipes.list.public')"
    hide-details
    data-test="public-select"
  />
  <div class="d-flex align-center ga-2">
    <v-select
      v-model="sortKey"
      :items="sortItems"
      :label="t('recipes.list.sort')"
      hide-details
      class="flex-grow-1"
      data-test="sort-select"
    />
    <v-btn
      :icon="sortDir === 'asc' ? mdiSortAscending : mdiSortDescending"
      variant="tonal"
      :aria-label="sortDir === 'asc' ? t('recipes.list.sortAsc') : t('recipes.list.sortDesc')"
      @click="emit('flip-sort-dir')"
    />
  </div>
  <v-btn-toggle v-model="view" mandatory selected-class="bg-primary" divided data-test="view-toggle">
    <v-btn :prepend-icon="mdiViewGridOutline" value="grid">{{ t('recipes.list.viewGrid') }}</v-btn>
    <v-btn :prepend-icon="mdiViewHeadline" value="table">{{ t('recipes.list.viewTable') }}</v-btn>
  </v-btn-toggle>
</template>
