<script setup lang="ts">
import { unitText } from '@/i18n/quantity'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { StapleDto } from '@shared/api'
import { UNITS, type UnitCode } from '@shared/units'
import { useCreateStaple, useDeleteStaple, useIngredients, useUpdateStaple } from '@/api/catalog'
import { errorText } from '@/i18n/errors'
import { parseQuantity } from '@/features/recipes/form'
import { describeCadence, quantityInputText } from '../format'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
/** Upravovaná položka; bez nej sa pridáva nová. */
const props = defineProps<{ staple: StapleDto | null }>()

const name = ref('')
const quantity = ref('')
const unit = ref<UnitCode | null>(null)
const everyNWeeks = ref(1)
const error = ref('')
const confirmDelete = ref(false)

const { data: ingredients } = useIngredients()
const create = useCreateStaple()
const update = useUpdateStaple()
const remove = useDeleteStaple()
const saving = computed(() => create.isPending.value || update.isPending.value)

watch(open, (isOpen) => {
  if (!isOpen) return
  const s = props.staple
  name.value = s?.name ?? ''
  quantity.value = quantityInputText(s?.quantity)
  unit.value = s?.unit ?? null
  everyNWeeks.value = s?.everyNWeeks ?? 1
  error.value = ''
  confirmDelete.value = false
})

const unitItems = computed(() =>
  UNITS.map((u) => ({ title: unitText(u.code), value: u.code, subtitle: t(`common.unit.${u.code}`) })),
)
const cadenceItems = computed(() => [1, 2, 3, 4, 6, 8].map((n) => ({ title: describeCadence(n), value: n })))
const nameItems = computed(() => ingredients.value?.map((i) => i.name) ?? [])

async function onSave() {
  const q = parseQuantity(quantity.value)
  if (!props.staple && !name.value.trim()) return void (error.value = t('pantry.staple.nameRequired'))
  if (q !== null && !(Number.isFinite(q) && q > 0))
    return void (error.value = t('pantry.staple.quantityInvalid'))
  const common = { quantity: q, unit: q === null ? null : unit.value, everyNWeeks: everyNWeeks.value }
  try {
    if (props.staple) await update.mutateAsync({ id: props.staple.id, patch: common })
    else await create.mutateAsync({ name: name.value.trim(), ...common })
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'pantry.staple.saveFailed')
  }
}

async function onDelete() {
  if (!props.staple) return
  try {
    await remove.mutateAsync(props.staple.id)
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'pantry.staple.deleteFailed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card :title="staple ? t('pantry.staple.editTitle') : t('pantry.staple.newTitle')">
      <v-card-text class="d-flex flex-column ga-3">
        <p v-if="!staple" class="text-body-medium text-medium-emphasis">
          {{ t('pantry.staple.intro') }}
        </p>
        <v-combobox
          v-model="name"
          :items="nameItems"
          :label="t('pantry.staple.name')"
          :disabled="Boolean(staple)"
          hide-details
          autofocus
        />
        <v-row density="compact">
          <v-col cols="6">
            <v-text-field
              v-model="quantity"
              autocomplete="off"
              :label="t('pantry.staple.quantity')"
              inputmode="decimal"
              hide-details
            />
          </v-col>
          <v-col cols="6">
            <v-select
              v-model="unit"
              :items="unitItems"
              item-props
              :label="t('pantry.staple.unit')"
              clearable
              hide-details
              :disabled="!quantity.trim()"
            />
          </v-col>
        </v-row>
        <v-select
          v-model="everyNWeeks"
          :items="cadenceItems"
          :label="t('pantry.staple.cadence')"
          hide-details
        />
        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <template v-if="staple">
          <v-btn v-if="!confirmDelete" color="error" variant="text" @click="confirmDelete = true">{{
            t('common.actions.delete')
          }}</v-btn>
          <v-btn v-else color="error" :loading="remove.isPending.value" @click="onDelete">{{
            t('pantry.staple.reallyDelete')
          }}</v-btn>
        </template>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn color="primary" :loading="saving" @click="onSave">{{ t('common.actions.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
