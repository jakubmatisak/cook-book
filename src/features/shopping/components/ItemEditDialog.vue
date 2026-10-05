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
const confirmDelete = ref(false)

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
  confirmDelete.value = false
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
      <v-card-text class="d-flex flex-column ga-3">
        <v-text-field v-model="name" label="Názov" hide-details autofocus @keydown.enter="onSave" />
        <v-row dense>
          <v-col cols="6">
            <v-text-field v-model="quantity" label="Množstvo" inputmode="decimal" hide-details />
          </v-col>
          <v-col cols="6">
            <v-select v-model="unit" :items="unitItems" item-props label="Jednotka" clearable hide-details />
          </v-col>
        </v-row>
        <v-select
          v-model="categoryId"
          :items="categoryItems"
          label="Kategória v obchode"
          clearable
          hide-details
        />
        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions>
        <v-btn v-if="!confirmDelete" color="error" variant="text" @click="confirmDelete = true">Zmazať</v-btn>
        <v-btn v-else color="error" :loading="remove.isPending.value" @click="onDelete">Naozaj zmazať</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Zrušiť</v-btn>
        <v-btn color="primary" :loading="update.isPending.value" @click="onSave">Uložiť</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
