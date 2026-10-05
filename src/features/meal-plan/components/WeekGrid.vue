<script setup lang="ts">
import { mdiPlus } from '@mdi/js'
import type { FamilyMemberDto, MealSlotDto, PlanEntryDto } from '@shared/api'
import { formatDayLabel } from '@shared/dates'
import { cellKey } from '../week'
import PlanEntryCard from './PlanEntryCard.vue'

defineProps<{
  dates: string[]
  slots: MealSlotDto[]
  groups: Map<string, PlanEntryDto[]>
  members: FamilyMemberDto[]
  today: string
}>()
defineEmits<{ add: [date: string, slotId: string]; edit: [entry: PlanEntryDto] }>()
</script>

<template>
  <div class="grid tw:overflow-x-auto" role="table" aria-label="Týždenný jedálniček">
    <div role="row" class="tw:contents">
      <div role="columnheader" />
      <div
        v-for="d in dates"
        :key="d"
        role="columnheader"
        class="tw:rounded-lg tw:px-2 tw:py-1 tw:text-center"
        :class="{ 'tw:bg-primary tw:text-white': d === today }"
      >
        <div class="tw:text-xs tw:font-bold tw:uppercase">{{ formatDayLabel(d).short }}</div>
        <div class="tw:text-sm">{{ formatDayLabel(d).date }}</div>
      </div>
    </div>
    <div v-for="slot in slots" :key="slot.id" role="row" class="tw:contents">
      <div
        role="rowheader"
        class="tw:pt-2 tw:text-sm tw:font-semibold"
        :class="{ 'tw:opacity-60': !slot.isEnabled }"
      >
        {{ slot.name }}
      </div>
      <div
        v-for="d in dates"
        :key="d"
        role="cell"
        class="cell tw:flex tw:flex-col tw:gap-1 tw:rounded-lg tw:p-1"
        :class="{ 'cell--today': d === today }"
      >
        <PlanEntryCard
          v-for="entry in groups.get(cellKey(d, slot.id)) ?? []"
          :key="entry.id"
          :entry="entry"
          :members="members"
          dense
          @edit="$emit('edit', $event)"
        />
        <v-btn
          size="x-small"
          variant="text"
          :icon="mdiPlus"
          class="tw:self-center tw:opacity-50 tw:hover:opacity-100"
          :aria-label="`Pridať ${slot.name} ${formatDayLabel(d).long}`"
          @click="$emit('add', d, slot.id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 6.5rem repeat(7, minmax(7.5rem, 1fr));
  gap: 6px;
}
.cell {
  background: rgba(var(--v-theme-surface-variant), 0.5);
  min-height: 3.5rem;
}
.cell--today {
  background: rgba(var(--v-theme-primary), 0.08);
}
</style>
