<script setup lang="ts">
import { unitText } from '@/i18n/quantity'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ShoppingItemDto } from '@shared/api'
import { UNITS, type UnitCode } from '@shared/units'
import { useShopCategories } from '@/api/catalog'
import { useDeleteItem, useUpdateItem } from '@/api/shopping'
import { parseQuantity } from '@/features/recipes/form'
import { currentLocale } from '@/i18n'
import { errorText } from '@/i18n/errors'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
const props = defineProps<{ item: ShoppingItemDto | null }>()

const name = ref('')
const quantity = ref('')
const unit = ref<UnitCode | null>(null)
const categoryId = ref<string | null>(null)
const error = ref('')
const confirmDelete = ref(false)

const { data: categories } = useShopCategories()
const update = useUpdateItem()
const remove = useDeleteItem()

watch(open, (isOpen) => {
  if (!isOpen || !props.item) return
  name.value = props.item.name
  // Desatinná čiarka podľa jazyka, bez oddeľovania tisícov (aby sa dalo načítať späť).
  quantity.value =
    props.item.quantity === null
      ? ''
      : new Intl.NumberFormat(currentLocale(), { useGrouping: false, maximumFractionDigits: 10 }).format(
          props.item.quantity,
        )
  unit.value = props.item.unit
  categoryId.value = props.item.shopCategoryId
  error.value = ''
  confirmDelete.value = false
})

const unitItems = computed(() =>
  UNITS.map((u) => ({ title: unitText(u.code), value: u.code, subtitle: t(`common.unit.${u.code}`) })),
)
const categoryItems = computed(() => categories.value?.map((c) => ({ title: c.name, value: c.id })) ?? [])

async function onSave() {
  if (!props.item) return
  const q = parseQuantity(quantity.value)
  if (!name.value.trim()) return void (error.value = t('shopping.edit.errors.nameRequired'))
  if (q !== null && !(Number.isFinite(q) && q > 0))
    return void (error.value = t('shopping.edit.errors.quantityInvalid'))
  try {
    await update.mutateAsync({
      item: props.item,
      patch: { name: name.value.trim(), quantity: q, unit: unit.value, shopCategoryId: categoryId.value },
    })
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'shopping.edit.errors.saveFailed')
  }
}

async function onDelete() {
  if (!props.item) return
  try {
    await remove.mutateAsync(props.item)
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'shopping.edit.errors.deleteFailed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card :title="t('shopping.edit.title')">
      <v-card-text class="d-flex flex-column ga-3">
        <v-text-field
          v-model="name"
          autocomplete="off"
          :label="t('shopping.edit.name')"
          hide-details
          autofocus
          @keydown.enter="onSave"
        />
        <v-row density="compact">
          <v-col cols="6">
            <v-text-field
              v-model="quantity"
              autocomplete="off"
              :label="t('shopping.edit.quantity')"
              inputmode="decimal"
              hide-details
            />
          </v-col>
          <v-col cols="6">
            <v-select
              v-model="unit"
              :items="unitItems"
              item-props
              :label="t('shopping.edit.unit')"
              clearable
              hide-details
            />
          </v-col>
        </v-row>
        <v-select
          v-model="categoryId"
          :items="categoryItems"
          :label="t('shopping.edit.category')"
          clearable
          hide-details
        />
        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="flex-wrap ga-1">
        <v-btn v-if="!confirmDelete" color="error" variant="text" @click="confirmDelete = true">{{
          t('common.actions.delete')
        }}</v-btn>
        <v-btn v-else color="error" :loading="remove.isPending.value" @click="onDelete">{{
          t('shopping.confirmDelete')
        }}</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn color="primary" :loading="update.isPending.value" @click="onSave">{{
          t('common.actions.save')
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
