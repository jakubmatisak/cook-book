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
  <div class="tw:flex tw:flex-col tw:gap-3">
    <v-card
      v-for="d in dates"
      :id="`den-${d}`"
      :key="d"
      :color="d === today ? 'primary' : undefined"
      :variant="d === today ? 'outlined' : 'flat'"
    >
      <div class="tw:flex tw:items-baseline tw:gap-2 tw:px-4 tw:pt-3">
        <span class="text-subtitle-1 tw:font-bold tw:capitalize">{{ formatDayLabel(d).long }}</span>
        <span class="text-body-2 text-medium-emphasis">{{ formatDayLabel(d).date }}</span>
        <v-chip v-if="d === today" size="x-small" color="primary" variant="flat">dnes</v-chip>
      </div>
      <div class="tw:flex tw:flex-col tw:px-2 tw:pb-2 tw:pt-1">
        <div
          v-for="slot in slots"
          :key="slot.id"
          class="tw:grid tw:grid-cols-[5.5rem_1fr_auto] tw:items-center tw:gap-2 tw:border-b tw:border-on-surface/5 tw:py-1 tw:last:border-b-0"
        >
          <span class="tw:pl-2 tw:text-xs tw:font-semibold tw:uppercase tw:opacity-70">{{ slot.name }}</span>
          <div class="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
            <PlanEntryCard
              v-for="entry in groups.get(cellKey(d, slot.id)) ?? []"
              :key="entry.id"
              :entry="entry"
              :members="members"
              @edit="$emit('edit', $event)"
            />
          </div>
          <v-btn
            :icon="mdiPlus"
            size="small"
            variant="text"
            color="primary"
            :aria-label="`Pridať ${slot.name} ${formatDayLabel(d).long}`"
            @click="$emit('add', d, slot.id)"
          />
        </div>
      </div>
    </v-card>
  </div>
</template>
