<script setup lang="ts">
import { mdiPotSteamOutline } from '@mdi/js'
import { useRouter } from 'vue-router'
import type { RecipeSummaryDto } from '@shared/api'
import { DIFFICULTY_LABELS, RECIPE_CATEGORY_LABELS } from '@shared/recipes'
import { formatDate, formatMinutes, totalMinutes } from '@/lib/format'
import type { TableSort } from '../listQuery'
import FavoriteButton from './FavoriteButton.vue'

const sortBy = defineModel<TableSort[]>('sortBy', { required: true })
defineProps<{ items: RecipeSummaryDto[] }>()
const router = useRouter()

const headers = [
  { title: '', key: 'coverImageUrl', sortable: false, width: 72 },
  { title: 'Názov', key: 'title' },
  { title: 'Kategória', key: 'category', sortable: false },
  { title: 'Čas', key: 'totalMinutes' },
  { title: 'Náročnosť', key: 'difficulty' },
  { title: 'Naposledy varené', key: 'lastCookedAt' },
  { title: 'Pridané', key: 'createdAt' },
  { title: '', key: 'isFavorite', sortable: false, align: 'end' as const, width: 64 },
]

const minutes = (r: RecipeSummaryDto) => totalMinutes(r.prepMinutes, r.cookMinutes)
const openRecipe = (_event: Event, { item }: { item: RecipeSummaryDto }) =>
  void router.push(`/recepty/${item.id}`)
</script>

<template>
  <v-card>
    <!-- Zoradenie robí server (rovnaká logika ako pri mriežke), tabuľka len zobrazuje a posiela zvolený stĺpec. -->
    <v-data-table-server
      v-model:sort-by="sortBy"
      :headers="headers"
      :items="items"
      :items-length="items.length"
      :items-per-page="-1"
      item-value="id"
      density="comfortable"
      hover
      hide-default-footer
      must-sort
      @click:row="openRecipe"
    >
      <template #item.coverImageUrl="{ item }">
        <v-avatar rounded="sm" size="48" color="surface-variant" class="my-1">
          <v-img v-if="item.coverImageUrl" :src="item.coverImageUrl" cover />
          <v-icon v-else :icon="mdiPotSteamOutline" color="primary" />
        </v-avatar>
      </template>
      <template #item.title="{ item }">
        <div class="font-weight-bold">{{ item.title }}</div>
        <div v-if="item.missing" class="text-caption text-medium-emphasis">
          {{ item.missing.length === 0 ? 'Máš všetko' : `Chýba: ${item.missing.join(', ')}` }}
        </div>
      </template>
      <template #item.category="{ item }">{{ RECIPE_CATEGORY_LABELS[item.category] }}</template>
      <template #item.totalMinutes="{ item }">
        <template v-if="minutes(item) !== null">{{ formatMinutes(minutes(item)!) }}</template>
        <span v-else class="text-medium-emphasis">–</span>
      </template>
      <template #item.difficulty="{ item }">
        {{ DIFFICULTY_LABELS[item.difficulty as 1 | 2 | 3] }}
      </template>
      <template #item.lastCookedAt="{ item }">
        <template v-if="item.lastCookedAt">{{ formatDate(item.lastCookedAt) }}</template>
        <span v-else class="text-medium-emphasis">nikdy</span>
      </template>
      <template #item.createdAt="{ item }">{{ formatDate(item.createdAt) }}</template>
      <template #item.isFavorite="{ item }">
        <FavoriteButton :recipe-id="item.id" :is-favorite="item.isFavorite" size="x-small" />
      </template>
    </v-data-table-server>
  </v-card>
</template>
