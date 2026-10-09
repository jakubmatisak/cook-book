<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlanEntryDto } from '@shared/api'
import { useClearDays } from '@/api/plan'
import { errorText } from '@/i18n/errors'
import { formatDayLabel, tc } from '@/i18n/format'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
const props = defineProps<{ dates: string[]; entries: PlanEntryDto[] }>()
const emit = defineEmits<{ cleared: [count: number] }>()

const selected = ref<string[]>([])
const error = ref('')
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    selected.value = []
    error.value = ''
  },
  { immediate: true },
)

const countOn = (date: string) => props.entries.filter((e) => e.date === date).length
const chosen = computed(() => props.entries.filter((e) => selected.value.includes(e.date)))
// Zvyšky v nevybraných dňoch, ktorých varenie sa maže, zmizne spolu s ním.
const leftoversElsewhere = computed(() => {
  const ids = new Set(chosen.value.map((e) => e.id))
  return props.entries.some(
    (e) => e.leftoverOfEntryId && ids.has(e.leftoverOfEntryId) && !selected.value.includes(e.date),
  )
})
const dayLabel = (date: string) => {
  const label = formatDayLabel(date)
  return `${label.short} ${label.date}`
}
const selectWeek = () => (selected.value = props.dates.filter((d) => countOn(d) > 0))

const clear = useClearDays()
async function onConfirm() {
  error.value = ''
  try {
    const dates = props.dates.filter((d) => selected.value.includes(d))
    const { removed } = await clear.mutateAsync(dates)
    emit('cleared', removed)
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'plan.clearDays.failed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="480">
    <v-card :title="t('plan.clearDays.title')" data-test="clear-days-dialog">
      <v-card-text class="d-flex flex-column ga-3">
        <p class="text-body-medium text-medium-emphasis">{{ t('plan.clearDays.text') }}</p>
        <v-chip-group v-model="selected" multiple column filter color="error">
          <v-chip
            v-for="date in dates"
            :key="date"
            :value="date"
            :disabled="!countOn(date)"
            variant="outlined"
            :data-test="`clear-day-${date}`"
          >
            {{ dayLabel(date) }} · {{ countOn(date) }}
          </v-chip>
        </v-chip-group>
        <div>
          <v-btn size="small" variant="tonal" data-test="clear-days-week" @click="selectWeek">
            {{ t('plan.clearDays.wholeWeek') }}
          </v-btn>
        </div>
        <p v-if="chosen.length" class="text-body-medium font-weight-medium">
          {{ t('plan.clearDays.count', { meals: tc('common.plural.meals', chosen.length) }) }}
        </p>
        <v-alert
          v-if="leftoversElsewhere"
          type="warning"
          density="compact"
          :text="t('plan.clearDays.leftovers')"
        />
        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn
          color="error"
          variant="flat"
          :disabled="!chosen.length"
          :loading="clear.isPending.value"
          data-test="clear-days-confirm"
          @click="onConfirm"
        >
          {{ t('plan.clearDays.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
