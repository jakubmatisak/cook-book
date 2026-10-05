<script setup lang="ts">
import { mdiDeleteOutline } from '@mdi/js'
import { ref, watch } from 'vue'
import type { TemplateApplyResult } from '@shared/api'
import { formatWeekRange } from '@shared/dates'
import { useApplyTemplate, useDeleteTemplate, useTemplates } from '@/api/plan'
import { plural } from '@/lib/format'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ toDate: string }>()
const emit = defineEmits<{ applied: [result: TemplateApplyResult] }>()

const { data: templates, isPending } = useTemplates()
const apply = useApplyTemplate()
const remove = useDeleteTemplate()

const selected = ref<string | null>(null)
const replace = ref(false)
const error = ref('')
const confirmDeleteId = ref<string | null>(null)

watch(open, (isOpen) => {
  if (!isOpen) return
  selected.value = null
  replace.value = false
  error.value = ''
  confirmDeleteId.value = null
})

async function onApply() {
  if (!selected.value) return void (error.value = 'Vyber šablónu.')
  try {
    emit(
      'applied',
      await apply.mutateAsync({ id: selected.value, toDate: props.toDate, replace: replace.value }),
    )
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Šablónu sa nepodarilo použiť.'
  }
}

async function onDelete(id: string) {
  try {
    await remove.mutateAsync(id)
    if (selected.value === id) selected.value = null
    confirmDeleteId.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Šablónu sa nepodarilo zmazať.'
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="480">
    <v-card title="Použiť šablónu">
      <v-card-text class="d-flex flex-column ga-3">
        <p class="text-body-2 text-medium-emphasis">
          Jedlá zo šablóny sa vložia do týždňa {{ formatWeekRange(toDate) }}.
        </p>
        <v-skeleton-loader v-if="isPending" type="list-item@2" />
        <p v-else-if="!templates?.length" class="text-body-2">
          Zatiaľ nemáš žiadnu šablónu. Uložíš ju z menu jedálnička cez „Uložiť týždeň ako šablónu“.
        </p>
        <v-radio-group v-else v-model="selected" hide-details>
          <div v-for="t in templates" :key="t.id" class="d-flex align-center">
            <v-radio
              :value="t.id"
              :label="`${t.name} · ${plural(t.entryCount, 'jedlo', 'jedlá', 'jedál')}`"
              color="primary"
              class="flex-grow-1"
            />
            <v-btn
              v-if="confirmDeleteId !== t.id"
              :icon="mdiDeleteOutline"
              size="small"
              variant="text"
              :aria-label="`Zmazať šablónu ${t.name}`"
              @click="confirmDeleteId = t.id"
            />
            <v-btn
              v-else
              color="error"
              size="small"
              :loading="remove.isPending.value"
              @click="onDelete(t.id)"
            >
              Naozaj zmazať
            </v-btn>
          </div>
        </v-radio-group>
        <v-checkbox
          v-if="templates?.length"
          v-model="replace"
          label="Nahradiť jedlá, ktoré tam už sú"
          hide-details
          density="compact"
        />
        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="open = false">Zrušiť</v-btn>
        <v-btn
          color="primary"
          :disabled="!templates?.length"
          :loading="apply.isPending.value"
          @click="onApply"
        >
          Použiť
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
