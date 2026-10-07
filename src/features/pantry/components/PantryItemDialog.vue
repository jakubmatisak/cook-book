<script setup lang="ts">
import { unitText } from '@/i18n/quantity'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PantryItemDto } from '@shared/api'
import { UNITS, type UnitCode } from '@shared/units'
import { useSavePantryItem, useTogglePantry } from '@/api/catalog'
import { errorText } from '@/i18n/errors'
import { parseQuantity } from '@/features/recipes/form'
import { quantityInputText } from '../format'

const { t } = useI18n()
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
  quantity.value = quantityInputText(item?.quantity)
  unit.value = item?.unit ?? null
  expiresOn.value = item?.expiresOn ?? ''
  location.value = item?.location ?? ''
  error.value = ''
})

const unitItems = computed(() =>
  UNITS.map((u) => ({ title: unitText(u.code), value: u.code, subtitle: t(`common.unit.${u.code}`) })),
)

async function onSave() {
  if (!props.ingredient) return
  const q = parseQuantity(quantity.value)
  if (q !== null && !(Number.isFinite(q) && q > 0))
    return void (error.value = t('pantry.item.quantityInvalid'))
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
    error.value = errorText(e, 'pantry.item.saveFailed')
  }
}

async function onRemove() {
  if (!props.ingredient) return
  try {
    await toggle.mutateAsync({ ingredientId: props.ingredient.id, inPantry: false })
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'pantry.item.removeFailed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card :title="ingredient?.name ?? t('pantry.item.title')">
      <v-card-text class="d-flex flex-column ga-3">
        <p class="text-body-2 text-medium-emphasis">
          {{ t('pantry.item.intro') }}
        </p>
        <v-row density="compact">
          <v-col cols="6">
            <v-text-field
              v-model="quantity"
              autocomplete="off"
              :label="t('pantry.item.quantity')"
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
              :label="t('pantry.item.unit')"
              clearable
              hide-details
              :disabled="!quantity.trim()"
            />
          </v-col>
        </v-row>
        <v-text-field
          v-model="expiresOn"
          autocomplete="off"
          :label="t('pantry.item.expiresOn')"
          type="date"
          clearable
          hide-details
        />
        <v-text-field v-model="location" autocomplete="off" :label="t('pantry.item.location')" hide-details />
        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-btn v-if="item" color="error" variant="text" :loading="toggle.isPending.value" @click="onRemove">
          {{ t('pantry.item.removeFromPantry') }}
        </v-btn>
        <v-btn variant="text" data-test="edit-ingredient-name" @click="emit('editIngredient')">
          {{ t('pantry.item.editIngredient') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn color="primary" :loading="save.isPending.value" @click="onSave">{{
          t('common.actions.save')
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
