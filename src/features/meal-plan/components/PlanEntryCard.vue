<script setup lang="ts">
import { mdiAlertOutline, mdiNoteTextOutline } from '@mdi/js'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FamilyMemberDto, PlanEntryDto } from '@shared/api'
import { entryPortions } from '@shared/portions'
import { formatNumber } from '@/i18n/format'

const { t } = useI18n()
const props = defineProps<{
  entry: PlanEntryDto
  members: FamilyMemberDto[]
  dense?: boolean
  /** Karta sa dá myšou presunúť na iný deň alebo jedlo dňa. */
  draggable?: boolean
}>()
defineEmits<{ edit: [entry: PlanEntryDto]; dragstart: [event: DragEvent, entry: PlanEntryDto] }>()

const warningText = computed(() =>
  props.entry.warnings
    .map((w) => t(`common.preference.warning.${w.kind}`, { name: w.memberName, label: w.label }))
    .join('; '),
)
const hasAllergy = computed(() => props.entry.warnings.some((w) => w.kind === 'allergy'))
const title = computed(() => props.entry.recipe?.title ?? props.entry.freeText ?? '')
const portions = computed(
  () =>
    entryPortions({ ...props.entry, guestIds: props.entry.presentGuestIds }, props.members) ??
    props.entry.recipe?.servings ??
    null,
)
const guestNames = computed(() =>
  props.members.filter((m) => props.entry.presentGuestIds.includes(m.id)).map((m) => m.name),
)
const subtitle = computed(() => {
  const parts: string[] = []
  if (props.entry.recipe?.deleted) parts.push(t('plan.card.deletedRecipe'))
  if (portions.value !== null) parts.push(t('plan.card.portions', { n: formatNumber(portions.value) }))
  if (guestNames.value.length) parts.push(t('plan.card.guests', { names: guestNames.value.join(', ') }))
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
    :aria-label="t('plan.card.editAria', { title })"
    :draggable="draggable ? 'true' : undefined"
    @click="$emit('edit', entry)"
    @dragstart="draggable && $emit('dragstart', $event, entry)"
  >
    <v-card-item class="pa-2">
      <template v-if="entry.warnings.length" #append>
        <v-icon
          :icon="mdiAlertOutline"
          :color="hasAllergy ? 'error' : 'warning'"
          size="small"
          :title="warningText"
          :aria-label="warningText"
          data-test="entry-warning"
        />
      </template>
      <!-- Nadpis cez v-card-subtitle: v-card-title má pevnú veľkú veľkosť písma, ktorú utility triedy neprebijú. -->
      <v-card-subtitle
        class="text-caption font-weight-bold text-wrap opacity-100 text-high-emphasis"
        :class="{ 'font-italic': !entry.recipe }"
      >
        {{ title }}
      </v-card-subtitle>
      <v-card-subtitle v-if="subtitle" class="text-caption">
        <v-icon v-if="entry.note && dense" :icon="mdiNoteTextOutline" size="12" class="me-1" />{{ subtitle }}
      </v-card-subtitle>
    </v-card-item>
  </v-card>
</template>
