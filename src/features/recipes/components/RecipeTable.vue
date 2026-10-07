<script setup lang="ts">
import { mdiEarth, mdiPotSteamOutline } from '@mdi/js'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import type { RecipeSummaryDto } from '@shared/api'
import { formatDate, formatMinutes } from '@/i18n/format'
import { totalMinutes } from '@/lib/format'
import type { TableSort } from '../listQuery'
import FavoriteButton from './FavoriteButton.vue'

const { t } = useI18n()
const sortBy = defineModel<TableSort[]>('sortBy', { required: true })
const props = defineProps<{ items: RecipeSummaryDto[]; selectable?: boolean }>()
const selected = defineModel<string[]>('selected', { default: () => [] })
const router = useRouter()
// Na malom displeji je namiesto tabuľky kompaktný zoznam (názov, kategória, čas); zoradenie je v paneli Filtre.
const { smAndDown } = useDisplay()

const headers = computed(() => [
  { title: '', key: 'coverImageUrl', sortable: false, width: 72 },
  { title: t('recipes.table.name'), key: 'title' },
  { title: t('recipes.table.category'), key: 'category', sortable: false },
  { title: t('recipes.table.time'), key: 'totalMinutes' },
  { title: t('recipes.table.difficulty'), key: 'difficulty' },
  { title: t('recipes.table.lastCooked'), key: 'lastCookedAt' },
  { title: t('recipes.table.added'), key: 'createdAt' },
  { title: '', key: 'isFavorite', sortable: false, align: 'end' as const, width: 64 },
])

const minutes = (r: RecipeSummaryDto) => totalMinutes(r.prepMinutes, r.cookMinutes)
const rowSubtitle = (r: RecipeSummaryDto) => {
  const time = minutes(r)
  return [t(`common.category.${r.category}`), time === null ? null : formatMinutes(time)]
    .filter(Boolean)
    .join(' · ')
}
// V režime výberu klik na riadok recept vyberie, inak ho otvorí.
const openRecipe = (_event: Event, { item }: { item: RecipeSummaryDto }) => {
  if (item.householdName) void router.push(`/verejne/${item.id}`)
  else if (props.selectable) {
    selected.value = selected.value.includes(item.id)
      ? selected.value.filter((id) => id !== item.id)
      : [...selected.value, item.id]
  } else void router.push(`/recepty/${item.id}`)
}
</script>

<template>
  <v-card v-if="smAndDown">
    <v-list lines="two" class="py-0">
      <v-list-item
        v-for="item in items"
        :key="item.id"
        :title="item.title"
        :subtitle="rowSubtitle(item)"
        :active="selected.includes(item.id)"
        data-test="recipe-row"
        @click="openRecipe($event, { item })"
      >
        <template #prepend>
          <v-checkbox-btn
            v-if="selectable && !item.householdName"
            :model-value="selected.includes(item.id)"
            color="primary"
            class="me-2"
            :aria-label="item.title"
            @click.stop="openRecipe($event, { item })"
          />
          <v-avatar v-else rounded="sm" size="40" color="surface-variant">
            <v-img v-if="item.coverImageUrl" :src="item.coverImageUrl" cover />
            <v-icon
              v-else
              :icon="item.householdName ? mdiEarth : mdiPotSteamOutline"
              color="primary"
              size="20"
            />
          </v-avatar>
        </template>
        <template #append>
          <FavoriteButton
            v-if="!item.householdName"
            :recipe-id="item.id"
            :is-favorite="item.isFavorite"
            size="x-small"
          />
        </template>
      </v-list-item>
    </v-list>
  </v-card>
  <v-card v-else>
    <!-- Zoradenie robí server (rovnaká logika ako pri mriežke), tabuľka len zobrazuje a posiela zvolený stĺpec. -->
    <v-data-table-server
      v-model="selected"
      v-model:sort-by="sortBy"
      :headers="headers"
      :items="items"
      :items-length="items.length"
      :items-per-page="-1"
      item-value="id"
      hover
      hide-default-footer
      must-sort
      :show-select="selectable"
      :item-selectable="(item: RecipeSummaryDto) => !item.householdName"
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
        <v-chip
          v-if="item.visibility === 'public'"
          size="x-small"
          color="info"
          variant="tonal"
          :prepend-icon="mdiEarth"
          class="mt-1"
          data-test="public-badge"
        >
          {{
            item.householdName
              ? t('recipes.badge.publicFrom', { name: item.householdName })
              : t('recipes.badge.public')
          }}
        </v-chip>
        <div v-if="item.missing" class="text-caption text-medium-emphasis">
          {{
            item.missing.length === 0
              ? t('recipes.missing.haveAll')
              : t('recipes.missing.some', { items: item.missing.join(', ') })
          }}
        </div>
      </template>
      <template #item.category="{ item }">{{ t(`common.category.${item.category}`) }}</template>
      <template #item.totalMinutes="{ item }">
        <template v-if="minutes(item) !== null">{{ formatMinutes(minutes(item)!) }}</template>
        <span v-else class="text-medium-emphasis">–</span>
      </template>
      <template #item.difficulty="{ item }">
        {{ t(`common.difficulty.${item.difficulty}`) }}
      </template>
      <template #item.lastCookedAt="{ item }">
        <template v-if="item.lastCookedAt">{{ formatDate(item.lastCookedAt) }}</template>
        <span v-else class="text-medium-emphasis">{{ t('recipes.table.never') }}</span>
      </template>
      <template #item.createdAt="{ item }">{{ formatDate(item.createdAt) }}</template>
      <template #item.isFavorite="{ item }">
        <FavoriteButton
          v-if="!item.householdName"
          :recipe-id="item.id"
          :is-favorite="item.isFavorite"
          size="x-small"
        />
      </template>
    </v-data-table-server>
  </v-card>
</template>
