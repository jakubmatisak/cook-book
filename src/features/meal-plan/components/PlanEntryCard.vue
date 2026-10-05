<script setup lang="ts">
import { mdiNoteTextOutline } from '@mdi/js'
import { computed } from 'vue'
import type { FamilyMemberDto, PlanEntryDto } from '@shared/api'
import { entryPortions } from '@shared/portions'

const props = defineProps<{
  entry: PlanEntryDto
  members: FamilyMemberDto[]
  dense?: boolean
  /** Karta sa dá myšou presunúť na iný deň alebo jedlo dňa. */
  draggable?: boolean
}>()
defineEmits<{ edit: [entry: PlanEntryDto]; dragstart: [event: DragEvent, entry: PlanEntryDto] }>()

const title = computed(() => props.entry.recipe?.title ?? props.entry.freeText ?? '')
const portions = computed(
  () => entryPortions(props.entry, props.members) ?? props.entry.recipe?.servings ?? null,
)
const subtitle = computed(() => {
  const parts: string[] = []
  if (props.entry.recipe?.deleted) parts.push('zmazaný recept')
  if (portions.value !== null) parts.push(`${String(portions.value).replace('.', ',')} porc.`)
  if (props.entry.note && !props.dense) parts.push(props.entry.note)
  return parts.join(' · ')
})
</script>

<template>
  <v-card
    :variant="entry.recipe ? 'tonal' : 'outlined'"
    :color="entry.recipe?.deleted ? 'error' : entry.recipe ? 'primary' : undefined"
    density="compact"
    link
    :aria-label="`Upraviť: ${title}`"
    :draggable="draggable ? 'true' : undefined"
    @click="$emit('edit', entry)"
    @dragstart="draggable && $emit('dragstart', $event, entry)"
  >
    <v-card-item class="pa-2">
      <template v-if="entry.recipe?.coverImageUrl" #prepend>
        <v-avatar :size="dense ? 28 : 40" rounded="sm">
          <v-img :src="entry.recipe.coverImageUrl" cover />
        </v-avatar>
      </template>
      <v-card-title class="text-body-2 font-weight-bold text-wrap" :class="{ 'font-italic': !entry.recipe }">
        {{ title }}
      </v-card-title>
      <v-card-subtitle v-if="subtitle" class="text-caption">
        <v-icon v-if="entry.note && dense" :icon="mdiNoteTextOutline" size="12" class="me-1" />{{ subtitle }}
      </v-card-subtitle>
    </v-card-item>
  </v-card>
</template>
