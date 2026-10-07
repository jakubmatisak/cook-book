<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FamilyMemberDto } from '@shared/api'
import { isIsoDate } from '@shared/dates'
import { useCreateStays } from '@/api/plan'
import { errorText } from '@/i18n/errors'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{
  members: FamilyMemberDto[]
  /** Prvý a posledný deň zobrazeného týždňa: predvolené dni pobytu. */
  weekFrom: string
  weekTo: string
  canAddGuests: boolean
}>()
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const create = useCreateStays()

const memberIds = ref<string[]>([])
const fromDate = ref('')
const toDate = ref('')
const error = ref('')

const guestItems = computed(() =>
  props.members.filter((m) => m.kind === 'guest').map((m) => ({ title: m.name, value: m.id })),
)

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    memberIds.value = guestItems.value.length === 1 ? [guestItems.value[0]!.value] : []
    fromDate.value = props.weekFrom
    toDate.value = props.weekTo
    error.value = ''
  },
  { immediate: true },
)

const useWholeWeek = () => {
  fromDate.value = props.weekFrom
  toDate.value = props.weekTo
}

async function save() {
  error.value = ''
  if (memberIds.value.length === 0) return void (error.value = t('plan.stays.dialog.pickGuests'))
  if (!isIsoDate(fromDate.value) || !isIsoDate(toDate.value)) {
    return void (error.value = t('plan.stays.dialog.invalidDates'))
  }
  if (fromDate.value > toDate.value) return void (error.value = t('plan.stays.dialog.order'))
  try {
    await create.mutateAsync({ memberIds: memberIds.value, fromDate: fromDate.value, toDate: toDate.value })
    open.value = false
    emit('saved')
  } catch (e) {
    error.value = errorText(e)
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="460">
    <v-card :title="t('plan.stays.dialog.title')">
      <v-card-text class="d-flex flex-column ga-3">
        <p class="text-body-2 text-medium-emphasis">{{ t('plan.stays.dialog.text') }}</p>

        <v-alert v-if="!guestItems.length" type="info" density="compact" data-test="stay-no-guests">
          {{ t('plan.stays.dialog.noGuests') }}
          <template v-if="canAddGuests" #append>
            <v-btn variant="text" size="small" to="/people" @click="open = false">
              {{ t('plan.stays.dialog.openFamily') }}
            </v-btn>
          </template>
        </v-alert>
        <v-select
          v-else
          v-model="memberIds"
          :items="guestItems"
          :label="t('plan.stays.dialog.guests')"
          multiple
          chips
          closable-chips
          hide-details="auto"
          data-test="stay-guests"
        />

        <v-row density="compact">
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="fromDate"
              type="date"
              :label="t('plan.stays.dialog.from')"
              hide-details
              data-test="stay-from"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="toDate"
              type="date"
              :label="t('plan.stays.dialog.to')"
              hide-details
              data-test="stay-to"
            />
          </v-col>
        </v-row>
        <div>
          <v-btn size="small" variant="text" @click="useWholeWeek">{{
            t('plan.stays.dialog.wholeWeek')
          }}</v-btn>
        </div>

        <v-alert v-if="error" type="error" density="compact" :text="error" data-test="stay-error" />
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn
          color="primary"
          :loading="create.isPending.value"
          :disabled="!guestItems.length"
          data-test="stay-save"
          @click="save"
        >
          {{ t('common.actions.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
