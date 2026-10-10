<script setup lang="ts">
import {
  mdiCheck,
  mdiCheckDecagramOutline,
  mdiFridgeOutline,
  mdiHeart,
  mdiSortAscending,
  mdiSortDescending,
} from '@mdi/js'
import { useI18n } from 'vue-i18n'
import type { SortKey } from '@shared/recipeFacets'
import type { KidsMode, PublicMode, SharedMode } from '../listQuery'

/**
 * Rýchle filtre a zoradenie receptov pod sebou – na mobile sú v paneli Filtre, aby nad zoznamom ostalo len
 * hľadanie. Hodnoty aj zmeny idú cez v-model, stav (adresu) drží stránka receptov.
 */
const { t } = useI18n()
defineProps<{
  /** Len Detské recepty a Recepty od iných (na počítači sú ostatné filtre v riadku nad zoznamom). */
  visibilityOnly?: boolean
  kidsEnabled: boolean
  kidsItems: { value: KidsMode; title: string }[]
  publicItems: { value: PublicMode; title: string }[]
  sharedItems: { value: SharedMode; title: string }[]
  sortItems: { value: SortKey; title: string }[]
  sortDir: 'asc' | 'desc'
  missing: number | 'all'
  canCook: number
  missingOne: number
}>()
const emit = defineEmits<{ 'flip-sort-dir': []; 'update:missing': [value: number | 'all'] }>()
const favorite = defineModel<boolean>('favorite', { required: true })
const verified = defineModel<boolean>('verified', { required: true })
const kids = defineModel<KidsMode>('kids', { required: true })
const publicMode = defineModel<PublicMode>('publicMode', { required: true })
const sharedMode = defineModel<SharedMode>('sharedMode', { required: true })
const pantryMode = defineModel<boolean>('pantryMode', { required: true })
const sortKey = defineModel<SortKey | null>('sortKey', { required: true })
</script>

<template>
  <div v-if="!visibilityOnly" class="d-flex flex-wrap ga-2">
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
      :prepend-icon="verified ? mdiCheck : mdiCheckDecagramOutline"
      :color="verified ? 'primary' : undefined"
      :variant="verified ? 'flat' : 'outlined'"
      data-test="verified-toggle"
      @click="verified = !verified"
    >
      {{ t('recipes.list.verified') }}
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
  <!-- Čipy sa na úzkom displeji zalomia, tlačidlá vedľa seba by pretiekli. -->
  <v-chip-group
    v-if="pantryMode && !visibilityOnly"
    :model-value="missing"
    mandatory
    column
    selected-class="bg-primary"
    data-test="missing-toggle"
    @update:model-value="emit('update:missing', $event)"
  >
    <v-chip value="all" variant="outlined">{{ t('recipes.list.missingAll') }}</v-chip>
    <v-chip :value="0" variant="outlined">{{ t('recipes.list.missingCanCook', { n: canCook }) }}</v-chip>
    <v-chip :value="1" variant="outlined">{{ t('recipes.list.missingMaxOne', { n: missingOne }) }}</v-chip>
  </v-chip-group>
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
  <v-select
    v-model="sharedMode"
    :items="sharedItems"
    :label="t('sharing.filters.label')"
    hide-details
    data-test="shared-select"
  />
  <div v-if="!visibilityOnly" class="d-flex align-center ga-2">
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
</template>
