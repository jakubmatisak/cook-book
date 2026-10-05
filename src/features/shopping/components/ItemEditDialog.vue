<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ShoppingItemDto } from '@shared/api'
import { UNITS, type UnitCode } from '@shared/units'
import { useShopCategories } from '@/api/catalog'
import { useDeleteItem, useUpdateItem } from '@/api/shopping'
import { parseQuantity } from '@/features/recipes/form'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ item: ShoppingItemDto | null }>()

const name = ref('')
const quantity = ref('')
const unit = ref<UnitCode | null>(null)
const categoryId = ref<string | null>(null)
const error = ref('')

const { data: categories } = useShopCategories()
const update = useUpdateItem()
const remove = useDeleteItem()

watch(open, (isOpen) => {
  if (!isOpen || !props.item) return
  name.value = props.item.name
  quantity.value = props.item.quantity === null ? '' : String(props.item.quantity).replace('.', ',')
  unit.value = props.item.unit
  categoryId.value = props.item.shopCategoryId
  error.value = ''
})

const unitItems = UNITS.map((u) => ({ title: u.code, value: u.code, subtitle: u.label }))
const categoryItems = computed(() => categories.value?.map((c) => ({ title: c.name, value: c.id })) ?? [])

async function onSave() {
  if (!props.item) return
  const q = parseQuantity(quantity.value)
  if (!name.value.trim()) return void (error.value = 'Zadaj názov.')
  if (q !== null && !(Number.isFinite(q) && q > 0)) return void (error.value = 'Množstvo napr. 2 alebo 1,5.')
  try {
    await update.mutateAsync({
      item: props.item,
      patch: { name: name.value.trim(), quantity: q, unit: unit.value, shopCategoryId: categoryId.value },
    })
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Uloženie zlyhalo.'
  }
}

async function onDelete() {
  if (!props.item) return
  try {
    await remove.mutateAsync(props.item)
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Zmazanie zlyhalo.'
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card title="Upraviť položku">
      <v-card-text class="tw:flex tw:flex-col tw:gap-3">
        <v-text-field v-model="name" label="Názov" hide-details autofocus @keydown.enter="onSave" />
        <div class="tw:grid tw:grid-cols-2 tw:gap-3">
          <v-text-field v-model="quantity" label="Množstvo" inputmode="decimal" hide-details />
          <v-select v-model="unit" :items="unitItems" item-props label="Jednotka" clearable hide-details />
        </div>
        <v-select
          v-model="categoryId"
          :items="categoryItems"
          label="Kategória v obchode"
          clearable
          hide-details
        />
        <v-alert v-if="error" type="error" variant="tonal" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions>
        <v-btn color="error" variant="text" :loading="remove.isPending.value" @click="onDelete">Zmazať</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Zrušiť</v-btn>
        <v-btn color="primary" variant="flat" :loading="update.isPending.value" @click="onSave">Uložiť</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
