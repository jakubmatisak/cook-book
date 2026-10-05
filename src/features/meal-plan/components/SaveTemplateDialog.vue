<script setup lang="ts">
import { ref, watch } from 'vue'
import type { WeekTemplateDto } from '@shared/api'
import { formatWeekRange } from '@shared/dates'
import { useSaveTemplate } from '@/api/plan'
import { plural } from '@/lib/format'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ fromDate: string; entryCount: number }>()
const emit = defineEmits<{ saved: [template: WeekTemplateDto] }>()

const name = ref('')
const error = ref('')
const save = useSaveTemplate()

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = ''
  error.value = ''
})

async function onSave() {
  const value = name.value.trim()
  if (!value) return void (error.value = 'Zadaj názov šablóny.')
  try {
    emit('saved', await save.mutateAsync({ name: value, fromDate: props.fromDate }))
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Šablónu sa nepodarilo uložiť.'
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card title="Uložiť týždeň ako šablónu">
      <v-card-text class="d-flex flex-column ga-3">
        <p class="text-body-2 text-medium-emphasis">
          Uloží sa {{ plural(entryCount, 'jedlo', 'jedlá', 'jedál') }} z týždňa
          {{ formatWeekRange(fromDate) }}. Šablónu potom môžeš použiť na ktorýkoľvek týždeň.
        </p>
        <v-text-field
          v-model="name"
          label="Názov šablóny"
          placeholder="napr. Bežný týždeň"
          maxlength="60"
          autofocus
          hide-details="auto"
          :error-messages="error"
          @keydown.enter="onSave"
        />
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="open = false">Zrušiť</v-btn>
        <v-btn color="primary" :loading="save.isPending.value" @click="onSave">Uložiť</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
