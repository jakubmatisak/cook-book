<script setup lang="ts">
import { mdiCheckCircleOutline, mdiClockOutline, mdiPotSteamOutline } from '@mdi/js'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RecipeSummaryDto } from '@shared/api'
import { formatMinutes } from '@/i18n/format'
import { totalMinutes } from '@/lib/format'
import FavoriteButton from './FavoriteButton.vue'

const props = defineProps<{ recipe: RecipeSummaryDto }>()
const { t } = useI18n()

const time = computed(() => totalMinutes(props.recipe.prepMinutes, props.recipe.cookMinutes))
const subtitle = computed(() => {
  const parts = [t(`common.category.${props.recipe.category}`)]
  if (time.value !== null) parts.push(formatMinutes(time.value))
  return parts.join(' · ')
})
</script>

<template>
  <v-card :to="`/recepty/${recipe.id}`" class="h-100 d-flex flex-column">
    <!-- Fotka má vždy rovnaký pomer strán a neroztiahne sa (v-responsive inak vyplní zvyšok karty). -->
    <v-img
      v-if="recipe.coverImageUrl"
      :src="recipe.coverImageUrl"
      :aspect-ratio="4 / 3"
      cover
      class="flex-grow-0 flex-shrink-0"
    />
    <v-responsive v-else :aspect-ratio="4 / 3" class="bg-surface-variant flex-grow-0 flex-shrink-0">
      <div class="d-flex align-center justify-center h-100">
        <v-icon :icon="mdiPotSteamOutline" size="56" color="primary" class="opacity-60" />
      </div>
    </v-responsive>
    <div class="position-absolute top-0 right-0 ma-1">
      <FavoriteButton :recipe-id="recipe.id" :is-favorite="recipe.isFavorite" />
    </div>
    <v-card-item>
      <!-- Nadpis má vždy vyhradené dva riadky (dlhší sa skráti), aby mali všetky karty rovnakú výšku. -->
      <v-card-title
        class="text-wrap text-subtitle-1 font-weight-bold"
        style="
          line-height: 1.3;
          min-height: 2.6em;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        "
      >
        {{ recipe.title }}
      </v-card-title>
      <v-card-subtitle>
        <v-icon v-if="time !== null" :icon="mdiClockOutline" size="14" class="me-1" />{{ subtitle }}
      </v-card-subtitle>
    </v-card-item>
    <v-card-text v-if="recipe.missing" class="pt-0">
      <v-chip
        v-if="recipe.missing.length === 0"
        size="small"
        color="success"
        variant="tonal"
        :prepend-icon="mdiCheckCircleOutline"
      >
        {{ t('recipes.missing.haveAll') }}
      </v-chip>
      <v-chip v-else size="small" color="warning" variant="tonal">
        {{
          t('recipes.missing.some', {
            items: recipe.missing.slice(0, 3).join(', ') + (recipe.missing.length > 3 ? '…' : ''),
          })
        }}
      </v-chip>
    </v-card-text>
    <!-- Riadok tagov je vždy vyhradený, aj keď recept tagy nemá. -->
    <v-card-text class="pt-0 d-flex flex-wrap ga-1 align-start mt-auto" style="min-height: 2.25rem">
      <v-chip
        v-for="tag in recipe.tags.slice(0, 3)"
        :key="tag.id"
        size="x-small"
        :color="tag.color ?? 'secondary'"
        variant="tonal"
      >
        {{ tag.name }}
      </v-chip>
    </v-card-text>
  </v-card>
</template>
