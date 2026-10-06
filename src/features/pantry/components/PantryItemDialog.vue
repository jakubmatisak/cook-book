<script setup lang="ts">
import { ref, watch } from 'vue'
import type { PantryItemDto } from '@shared/api'
import { UNITS, type UnitCode } from '@shared/units'
import { useSavePantryItem, useTogglePantry } from '@/api/catalog'
import { parseQuantity } from '@/features/recipes/form'

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ editIngredient: [] }>()
const props = defineProps<{
  ingredient: { id: string; name: string } | null
  /** Aktuálna zásoba; chýba, keď ingrediencia ešte nie je doma. */
  item: PantryItemDto | undefined
}>()

const quantity = ref('')
const unit = ref<UnitCode | null>(null)
const expiresOn = ref('')
const location = ref('')
const error = ref('')

const save = useSavePantryItem()
const toggle = useTogglePantry()

watch(open, (isOpen) => {
  if (!isOpen) return
  const item = props.item
  quantity.value = item?.quantity == null ? '' : String(item.quantity).replace('.', ',')
  unit.value = item?.unit ?? null
  expiresOn.value = item?.expiresOn ?? ''
  location.value = item?.location ?? ''
  error.value = ''
})

const unitItems = UNITS.map((u) => ({ title: u.code, value: u.code, subtitle: u.label }))

async function onSave() {
  if (!props.ingredient) return
  const q = parseQuantity(quantity.value)
  if (q !== null && !(Number.isFinite(q) && q > 0))
    return void (error.value = 'Množstvo napr. 500 alebo 1,5.')
  try {
    await save.mutateAsync({
      ingredientId: props.ingredient.id,
      input: {
        quantity: q,
        unit: q === null ? null : unit.value,
        expiresOn: expiresOn.value || null,
        location: location.value.trim() || null,
      },
    })
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Uloženie zlyhalo.'
  }
}

async function onRemove() {
  if (!props.ingredient) return
  try {
    await toggle.mutateAsync({ ingredientId: props.ingredient.id, inPantry: false })
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Odstránenie zlyhalo.'
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card :title="ingredient?.name ?? 'Zásoba'">
      <v-card-text class="d-flex flex-column ga-3">
        <p class="text-body-2 text-medium-emphasis">
          Množstvo je nepovinné. Keď ho zadáš, nákupný zoznam ho od potreby odpočíta.
        </p>
        <v-row dense>
          <v-col cols="6">
            <v-text-field
              v-model="quantity"
              autocomplete="off"
              label="Množstvo"
              inputmode="decimal"
              hide-details
              autofocus
              @keydown.enter="onSave"
            />
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
        <v-text-field
          v-model="expiresOn"
          autocomplete="off"
          label="Trvanlivosť do"
          type="date"
          clearable
          hide-details
        />
        <v-text-field
          v-model="location"
          autocomplete="off"
          label="Kde to je (napr. chladnička)"
          hide-details
        />
        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-btn v-if="item" color="error" variant="text" :loading="toggle.isPending.value" @click="onRemove">
          Odstrániť zo špajze
        </v-btn>
        <v-btn variant="text" data-test="edit-ingredient-name" @click="emit('editIngredient')">
          Názov alebo zmazanie
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Zrušiť</v-btn>
        <v-btn color="primary" :loading="save.isPending.value" @click="onSave">Uložiť</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
