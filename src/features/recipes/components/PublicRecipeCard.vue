<script setup lang="ts">
import { mdiClockOutline, mdiPotSteamOutline } from '@mdi/js'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PublicRecipeSummaryDto } from '@shared/api'
import { formatMinutes } from '@/i18n/format'
import { totalMinutes } from '@/lib/format'

const props = defineProps<{ recipe: PublicRecipeSummaryDto }>()
const { t } = useI18n()

const time = computed(() => totalMinutes(props.recipe.prepMinutes, props.recipe.cookMinutes))
const subtitle = computed(() => {
  const parts = [t(`common.category.${props.recipe.category}`)]
  if (time.value !== null) parts.push(formatMinutes(time.value))
  return parts.join(' · ')
})
</script>

<template>
  <v-card :to="`/verejne/${recipe.id}`" class="h-100 d-flex flex-column" data-test="public-card">
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
    <v-card-item>
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
    <v-card-text class="pt-0 d-flex flex-wrap ga-1 align-start mt-auto" style="min-height: 2.25rem">
      <v-chip v-if="recipe.ownedByMe" size="x-small" color="primary" variant="tonal" data-test="mine-chip">
        {{ t('publicRecipes.mine') }}
      </v-chip>
      <v-chip v-else size="x-small" variant="outlined" data-test="author-chip">
        {{ t('publicRecipes.by', { name: recipe.householdName }) }}
      </v-chip>
    </v-card-text>
  </v-card>
</template>
