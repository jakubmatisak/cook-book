<script setup lang="ts">
import { mdiClockOutline, mdiPotSteamOutline } from '@mdi/js'
import { computed } from 'vue'
import type { RecipeSummaryDto } from '@shared/api'
import { RECIPE_CATEGORY_LABELS } from '@shared/recipes'
import { formatMinutes, totalMinutes } from '@/lib/format'
import FavoriteButton from './FavoriteButton.vue'

const props = defineProps<{ recipe: RecipeSummaryDto }>()

const time = computed(() => totalMinutes(props.recipe.prepMinutes, props.recipe.cookMinutes))
const visibleTags = computed(() => props.recipe.tags.slice(0, 3))
</script>

<template>
  <v-card :to="`/recepty/${recipe.id}`" class="tw:flex tw:h-full tw:flex-col tw:overflow-hidden">
    <div class="tw:relative">
      <v-img v-if="recipe.coverImageUrl" :src="recipe.coverImageUrl" :aspect-ratio="4 / 3" cover />
      <div
        v-else
        class="tw:flex tw:aspect-[4/3] tw:items-center tw:justify-center tw:bg-surface-variant"
        aria-hidden="true"
      >
        <v-icon :icon="mdiPotSteamOutline" size="56" color="primary" class="tw:opacity-60" />
      </div>
      <div class="tw:absolute tw:right-2 tw:top-2 tw:rounded-full tw:bg-surface/90">
        <FavoriteButton :recipe-id="recipe.id" :is-favorite="recipe.isFavorite" />
      </div>
    </div>
    <v-card-item class="tw:flex-1">
      <v-card-title class="tw:whitespace-normal tw:text-base tw:font-bold tw:leading-snug">
        {{ recipe.title }}
      </v-card-title>
      <v-card-subtitle class="tw:mt-1 tw:flex tw:items-center tw:gap-2">
        <span>{{ RECIPE_CATEGORY_LABELS[recipe.category] }}</span>
        <template v-if="time !== null">
          <span aria-hidden="true">·</span>
          <v-icon :icon="mdiClockOutline" size="14" />
          <span>{{ formatMinutes(time) }}</span>
        </template>
      </v-card-subtitle>
    </v-card-item>
    <v-card-text v-if="visibleTags.length" class="tw:flex tw:flex-wrap tw:gap-1 tw:pt-0">
      <v-chip v-for="tag in visibleTags" :key="tag.id" size="x-small" variant="tonal" color="secondary">
        {{ tag.name }}
      </v-chip>
    </v-card-text>
  </v-card>
</template>
