<script setup lang="ts">
import { mdiAccountPlusOutline } from '@mdi/js'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FamilyMemberDto, GuestStayDto } from '@shared/api'
import { formatDayLabel } from '@/i18n/format'

const props = defineProps<{ stays: GuestStayDto[]; members: FamilyMemberDto[] }>()
const emit = defineEmits<{ add: []; remove: [ids: string[]] }>()

const { t } = useI18n()

/** Pobyty s rovnakými dňami sa zlúčia do jedného čipu: „Teta Eva, Strýko Peter · 6. 10. – 8. 10.“. */
const groups = computed(() => {
  const byRange = new Map<string, { ids: string[]; names: string[]; from: string; to: string }>()
  for (const stay of props.stays) {
    const key = `${stay.fromDate}|${stay.toDate}`
    const group = byRange.get(key) ?? { ids: [], names: [], from: stay.fromDate, to: stay.toDate }
    group.ids.push(stay.id)
    const name = props.members.find((m) => m.id === stay.memberId)?.name
    if (name) group.names.push(name)
    byRange.set(key, group)
  }
  return [...byRange.entries()].map(([key, g]) => {
    const names = g.names.join(', ')
    const range =
      g.from === g.to
        ? formatDayLabel(g.from).date
        : `${formatDayLabel(g.from).date} – ${formatDayLabel(g.to).date}`
    return { key, ids: g.ids, names, label: t('plan.stays.chip', { names, range }) }
  })
})
</script>

<template>
  <div class="d-flex flex-wrap align-center ga-2 mb-3 d-print-none" data-test="stays-bar">
    <v-chip
      v-for="group in groups"
      :key="group.key"
      closable
      color="primary"
      variant="tonal"
      size="small"
      :close-label="t('plan.stays.remove', { names: group.names })"
      data-test="stay-chip"
      @click:close="emit('remove', group.ids)"
    >
      {{ group.label }}
    </v-chip>
    <v-btn
      size="small"
      variant="text"
      :prepend-icon="mdiAccountPlusOutline"
      data-test="stay-add"
      @click="emit('add')"
    >
      {{ t('plan.stays.add') }}
    </v-btn>
  </div>
</template>
