<script setup lang="ts">
import { mdiClockOutline, mdiPotSteamOutline } from '@mdi/js'
import { computed } from 'vue'
import type { RecipeSummaryDto } from '@shared/api'
import { RECIPE_CATEGORY_LABELS } from '@shared/recipes'
import { formatMinutes, totalMinutes } from '@/lib/format'
import FavoriteButton from './FavoriteButton.vue'

const props = defineProps<{ recipe: RecipeSummaryDto }>()

const time = computed(() => totalMinutes(props.recipe.prepMinutes, props.recipe.cookMinutes))
const subtitle = computed(() => {
  const parts = [RECIPE_CATEGORY_LABELS[props.recipe.category]]
  if (time.value !== null) parts.push(formatMinutes(time.value))
  return parts.join(' · ')
})
</script>

<template>
  <v-card :to="`/recepty/${recipe.id}`" class="h-100 d-flex flex-column">
    <v-img v-if="recipe.coverImageUrl" :src="recipe.coverImageUrl" :aspect-ratio="4 / 3" cover />
    <v-responsive v-else :aspect-ratio="4 / 3" class="bg-surface-variant">
      <div class="d-flex align-center justify-center h-100">
        <v-icon :icon="mdiPotSteamOutline" size="56" color="primary" class="opacity-60" />
      </div>
    </v-responsive>
    <div class="position-absolute top-0 right-0 ma-1">
      <FavoriteButton :recipe-id="recipe.id" :is-favorite="recipe.isFavorite" />
    </div>
    <v-card-item>
      <v-card-title class="text-wrap text-subtitle-1 font-weight-bold" style="line-height: 1.3">
        {{ recipe.title }}
      </v-card-title>
      <v-card-subtitle>
        <v-icon v-if="time !== null" :icon="mdiClockOutline" size="14" class="me-1" />{{ subtitle }}
      </v-card-subtitle>
    </v-card-item>
    <v-card-text v-if="recipe.tags.length" class="pt-0 d-flex flex-wrap ga-1">
      <v-chip
        v-for="tag in recipe.tags.slice(0, 3)"
        :key="tag.id"
        size="x-small"
        color="secondary"
        variant="tonal"
      >
        {{ tag.name }}
      </v-chip>
    </v-card-text>
  </v-card>
</template>
