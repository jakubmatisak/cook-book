<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { GenerateResult } from '@shared/api'
import { addDays, daysBetween, formatDayLabel, isIsoDate, startOfWeek } from '@shared/dates'
import { MAX_GENERATE_DAYS } from '@shared/schemas/shopping'
import { useGenerateList } from '@/api/shopping'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ listId: string; today: string; weekStartsOn: number }>()
const emit = defineEmits<{ done: [result: GenerateResult] }>()

type Preset = 'rest' | 'this' | 'next' | 'custom'
const preset = ref<Preset>('rest')
const customFrom = ref('')
const customTo = ref('')
const error = ref('')

const thisWeek = computed(() => startOfWeek(props.today, props.weekStartsOn))

const range = computed<{ from: string; to: string }>(() => {
  switch (preset.value) {
    case 'rest':
      return { from: props.today, to: addDays(thisWeek.value, 6) }
    case 'this':
      return { from: thisWeek.value, to: addDays(thisWeek.value, 6) }
    case 'next':
      return { from: addDays(thisWeek.value, 7), to: addDays(thisWeek.value, 13) }
    default:
      return { from: customFrom.value, to: customTo.value }
  }
})

watch(open, (isOpen) => {
  if (!isOpen) return
  customFrom.value = props.today
  customTo.value = addDays(props.today, 6)
  error.value = ''
})

const label = (iso: string) => {
  const d = formatDayLabel(iso)
  return `${d.short} ${d.date}`
}

const presets = computed(() => [
  {
    value: 'rest',
    title: 'Od dnes do konca týždňa',
    subtitle: `${label(props.today)} – ${label(addDays(thisWeek.value, 6))}`,
  },
  {
    value: 'this',
    title: 'Celý tento týždeň',
    subtitle: `${label(thisWeek.value)} – ${label(addDays(thisWeek.value, 6))}`,
  },
  {
    value: 'next',
    title: 'Budúci týždeň',
    subtitle: `${label(addDays(thisWeek.value, 7))} – ${label(addDays(thisWeek.value, 13))}`,
  },
  { value: 'custom', title: 'Vlastné dni', subtitle: '' },
])

const generate = useGenerateList()

async function onGenerate() {
  error.value = ''
  const { from, to } = range.value
  if (!isIsoDate(from) || !isIsoDate(to)) return void (error.value = 'Vyber dátum od aj do.')
  const days = daysBetween(from, to)
  if (days < 0) return void (error.value = 'Dátum „do“ musí byť po dátume „od“.')
  if (days >= MAX_GENERATE_DAYS) return void (error.value = `Najviac ${MAX_GENERATE_DAYS} dní naraz.`)
  try {
    const result = await generate.mutateAsync({ listId: props.listId, from, to })
    open.value = false
    emit('done', result)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Generovanie zlyhalo.'
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="460">
    <v-card title="Vygenerovať z jedálnička">
      <v-card-text class="d-flex flex-column ga-3">
        <p class="text-body-2 text-medium-emphasis">
          Spočíta ingrediencie naplánovaných receptov podľa porcií vašej rodiny. Nekúpené položky z minulého
          generovania sa nahradia, kúpené a ručne pridané ostanú.
        </p>
        <v-radio-group v-model="preset" hide-details>
          <v-radio v-for="p in presets" :key="p.value" :value="p.value" color="primary">
            <template #label>
              <span class="d-flex flex-column">
                <span class="font-weight-bold">{{ p.title }}</span>
                <span v-if="p.subtitle" class="text-caption text-medium-emphasis">{{ p.subtitle }}</span>
              </span>
            </template>
          </v-radio>
        </v-radio-group>
        <v-row v-if="preset === 'custom'" dense>
          <v-col cols="6"><v-text-field v-model="customFrom" type="date" label="Od" hide-details /></v-col>
          <v-col cols="6"><v-text-field v-model="customTo" type="date" label="Do" hide-details /></v-col>
        </v-row>
        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Zrušiť</v-btn>
        <v-btn color="primary" :loading="generate.isPending.value" @click="onGenerate">Vygenerovať</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
