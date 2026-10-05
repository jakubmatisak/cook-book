<script setup lang="ts">
import { useDisplay } from 'vuetify'
import type { TagDto } from '@shared/api'
import type { RecipeFacets } from '@shared/recipeFacets'
import type { FilterDimension, RecipeListState } from '../listQuery'
import RecipeFilterCard from './RecipeFilterCard.vue'

const open = defineModel<boolean>({ required: true })
defineProps<{
  state: RecipeListState
  facets: RecipeFacets
  tags: TagDto[]
  resultCount: number
}>()
const emit = defineEmits<{
  toggle: [dimension: FilterDimension, value: string | number]
  clear: []
}>()

const { mdAndUp } = useDisplay()
</script>

<template>
  <!-- Na počítači panel zboku, na telefóne celá obrazovka. -->
  <v-navigation-drawer v-if="mdAndUp" v-model="open" location="end" temporary width="340">
    <RecipeFilterCard
      :state="state"
      :facets="facets"
      :tags="tags"
      :result-count="resultCount"
      @toggle="(d, v) => emit('toggle', d, v)"
      @clear="emit('clear')"
      @close="open = false"
    />
  </v-navigation-drawer>
  <v-dialog v-else v-model="open" fullscreen transition="dialog-bottom-transition">
    <RecipeFilterCard
      :state="state"
      :facets="facets"
      :tags="tags"
      :result-count="resultCount"
      @toggle="(d, v) => emit('toggle', d, v)"
      @clear="emit('clear')"
      @close="open = false"
    />
  </v-dialog>
</template>
