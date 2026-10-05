<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { StapleDto } from '@shared/api'
import { UNITS, type UnitCode } from '@shared/units'
import { useCreateStaple, useDeleteStaple, useIngredients, useUpdateStaple } from '@/api/catalog'
import { parseQuantity } from '@/features/recipes/form'
import { describeCadence } from '../format'

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
  quantity.value = s?.quantity == null ? '' : String(s.quantity).replace('.', ',')
  unit.value = s?.unit ?? null
  everyNWeeks.value = s?.everyNWeeks ?? 1
  error.value = ''
  confirmDelete.value = false
})

const unitItems = UNITS.map((u) => ({ title: u.code, value: u.code, subtitle: u.label }))
const cadenceItems = [1, 2, 3, 4, 6, 8].map((n) => ({ title: describeCadence(n), value: n }))
const nameItems = computed(() => ingredients.value?.map((i) => i.name) ?? [])

async function onSave() {
  const q = parseQuantity(quantity.value)
  if (!props.staple && !name.value.trim()) return void (error.value = 'Zadaj názov položky.')
  if (q !== null && !(Number.isFinite(q) && q > 0)) return void (error.value = 'Množstvo napr. 2 alebo 1,5.')
  const common = { quantity: q, unit: q === null ? null : unit.value, everyNWeeks: everyNWeeks.value }
  try {
    if (props.staple) await update.mutateAsync({ id: props.staple.id, patch: common })
    else await create.mutateAsync({ name: name.value.trim(), ...common })
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Uloženie zlyhalo.'
  }
}

async function onDelete() {
  if (!props.staple) return
  try {
    await remove.mutateAsync(props.staple.id)
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Zmazanie zlyhalo.'
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card :title="staple ? 'Upraviť stálu položku' : 'Nová stála položka'">
      <v-card-text class="d-flex flex-column ga-3">
        <p v-if="!staple" class="text-body-2 text-medium-emphasis">
          Stále položky (mlieko, chlieb) sa pridajú do nákupu zakaždým, keď ho vygeneruješ, v zvolenom rytme.
        </p>
        <v-combobox
          v-model="name"
          :items="nameItems"
          label="Názov"
          :disabled="Boolean(staple)"
          hide-details
          autofocus
        />
        <v-row dense>
          <v-col cols="6">
            <v-text-field v-model="quantity" label="Množstvo" inputmode="decimal" hide-details />
          </v-col>
          <v-col cols="6">
            <v-select
              v-model="unit"
              :items="unitItems"
              item-props
              label="Jednotka"
              clearable
              hide-details
              :disabled="!quantity.trim()"
            />
          </v-col>
        </v-row>
        <v-select v-model="everyNWeeks" :items="cadenceItems" label="Ako často" hide-details />
        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <template v-if="staple">
          <v-btn v-if="!confirmDelete" color="error" variant="text" @click="confirmDelete = true"
            >Zmazať</v-btn
          >
          <v-btn v-else color="error" :loading="remove.isPending.value" @click="onDelete"
            >Naozaj zmazať</v-btn
          >
        </template>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Zrušiť</v-btn>
        <v-btn color="primary" :loading="saving" @click="onSave">Uložiť</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
