<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GenerateResult } from '@shared/api'
import { addDays, daysBetween, isIsoDate, startOfWeek } from '@shared/dates'
import { MAX_GENERATE_DAYS } from '@shared/schemas/shopping'
import { useGenerateList } from '@/api/shopping'
import { errorText } from '@/i18n/errors'
import { formatDayLabel, tc } from '@/i18n/format'

const { t } = useI18n()
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
    title: t('shopping.generate.presets.rest'),
    subtitle: `${label(props.today)} – ${label(addDays(thisWeek.value, 6))}`,
  },
  {
    value: 'this',
    title: t('shopping.generate.presets.this'),
    subtitle: `${label(thisWeek.value)} – ${label(addDays(thisWeek.value, 6))}`,
  },
  {
    value: 'next',
    title: t('shopping.generate.presets.next'),
    subtitle: `${label(addDays(thisWeek.value, 7))} – ${label(addDays(thisWeek.value, 13))}`,
  },
  { value: 'custom', title: t('shopping.generate.presets.custom'), subtitle: '' },
])

const generate = useGenerateList()

async function onGenerate() {
  error.value = ''
  const { from, to } = range.value
  if (!isIsoDate(from) || !isIsoDate(to)) return void (error.value = t('shopping.generate.errors.pickDates'))
  const days = daysBetween(from, to)
  if (days < 0) return void (error.value = t('shopping.generate.errors.order'))
  if (days >= MAX_GENERATE_DAYS) {
    return void (error.value = t('shopping.generate.errors.tooLong', {
      days: tc('common.plural.days', MAX_GENERATE_DAYS),
    }))
  }
  try {
    const result = await generate.mutateAsync({ listId: props.listId, from, to })
    open.value = false
    emit('done', result)
  } catch (e) {
    error.value = errorText(e, 'shopping.generate.errors.failed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="460">
    <v-card :title="t('shopping.generate.title')">
      <v-card-text class="d-flex flex-column ga-3">
        <p class="text-body-2 text-medium-emphasis">
          {{ t('shopping.generate.text') }}
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
          <v-col cols="6"
            ><v-text-field
              v-model="customFrom"
              autocomplete="off"
              type="date"
              :label="t('shopping.generate.from')"
              hide-details
          /></v-col>
          <v-col cols="6"
            ><v-text-field
              v-model="customTo"
              autocomplete="off"
              type="date"
              :label="t('shopping.generate.to')"
              hide-details
          /></v-col>
        </v-row>
        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn color="primary" :loading="generate.isPending.value" @click="onGenerate">{{
          t('shopping.generate.submit')
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
