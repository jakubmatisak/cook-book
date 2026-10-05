<script setup lang="ts">
import { mdiNoteTextOutline, mdiSilverwareForkKnife } from '@mdi/js'
import { computed } from 'vue'
import type { FamilyMemberDto, PlanEntryDto } from '@shared/api'
import { entryPortions } from '@shared/portions'

const props = defineProps<{ entry: PlanEntryDto; members: FamilyMemberDto[]; dense?: boolean }>()
defineEmits<{ edit: [entry: PlanEntryDto] }>()

const title = computed(() => props.entry.recipe?.title ?? props.entry.freeText ?? '')
const portions = computed(
  () => entryPortions(props.entry, props.members) ?? props.entry.recipe?.servings ?? null,
)
const portionsLabel = computed(() =>
  portions.value === null ? '' : String(portions.value).replace('.', ','),
)
</script>

<template>
  <button
    type="button"
    class="entry tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-xl tw:p-1.5 tw:text-left"
    :class="{ 'entry--free': !entry.recipe }"
    :aria-label="`Upraviť: ${title}`"
    @click="$emit('edit', entry)"
  >
    <v-avatar v-if="entry.recipe && !dense" size="36" rounded="lg" color="surface-variant">
      <v-img v-if="entry.recipe.coverImageUrl" :src="entry.recipe.coverImageUrl" cover />
      <v-icon v-else :icon="mdiSilverwareForkKnife" size="18" color="primary" />
    </v-avatar>
    <span class="tw:min-w-0 tw:flex-1">
      <span class="tw:block tw:truncate tw:text-sm tw:font-semibold" :class="{ 'tw:italic': !entry.recipe }">
        {{ title }}
      </span>
      <span class="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:opacity-70">
        <span v-if="entry.recipe?.deleted" class="text-error">zmazaný recept</span>
        <span v-if="portionsLabel">{{ portionsLabel }} porc.</span>
        <v-icon v-if="entry.note" :icon="mdiNoteTextOutline" size="12" :title="entry.note" />
      </span>
    </span>
  </button>
</template>

<style scoped>
.entry {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  transition: background 0.15s;
}
.entry:hover,
.entry:focus-visible {
  background: rgb(var(--v-theme-surface-variant));
}
.entry--free {
  background: transparent;
  border-style: dashed;
}
</style>
