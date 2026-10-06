<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { UNITS, type UnitCode } from '@shared/units'
import { useDeleteIngredient, useShopCategories, useUpdateIngredient } from '@/api/catalog'
import { errorText } from '@/i18n/errors'
import { unitText } from '@/i18n/quantity'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
const props = defineProps<{
  ingredient: {
    id: string
    name: string
    shopCategoryId?: string | null
    defaultUnit?: UnitCode | null
  } | null
}>()

const name = ref('')
const categoryId = ref<string | null>(null)
const unit = ref<UnitCode | null>(null)
const error = ref('')
const confirmDelete = ref(false)

const update = useUpdateIngredient()
const remove = useDeleteIngredient()
const { data: categories } = useShopCategories()
const categoryItems = computed(() => categories.value?.map((c) => ({ title: c.name, value: c.id })) ?? [])
const unitItems = computed(() =>
  UNITS.map((u) => ({ title: unitText(u.code), value: u.code, subtitle: t(`common.unit.${u.code}`) })),
)

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = props.ingredient?.name ?? ''
  categoryId.value = props.ingredient?.shopCategoryId ?? null
  unit.value = props.ingredient?.defaultUnit ?? null
  error.value = ''
  confirmDelete.value = false
})

async function onSave() {
  if (!props.ingredient) return
  const value = name.value.trim()
  if (!value) return void (error.value = t('ingredients.edit.nameRequired'))
  // Posiela sa len to, čo sa zmenilo; bez zmeny sa okno len zavrie.
  const patch: { name?: string; shopCategoryId?: string | null; defaultUnit?: UnitCode | null } = {}
  if (value !== props.ingredient.name) patch.name = value
  if (categoryId.value !== (props.ingredient.shopCategoryId ?? null)) patch.shopCategoryId = categoryId.value
  if (unit.value !== (props.ingredient.defaultUnit ?? null)) patch.defaultUnit = unit.value
  if (Object.keys(patch).length === 0) {
    open.value = false
    return
  }
  try {
    await update.mutateAsync({ id: props.ingredient.id, patch })
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'ingredients.edit.renameFailed')
  }
}

async function onDelete() {
  if (!props.ingredient) return
  try {
    await remove.mutateAsync(props.ingredient.id)
    open.value = false
  } catch (e) {
    // Napr. ingrediencia sa používa v receptoch: server povie, v koľkých.
    error.value = errorText(e, 'ingredients.edit.deleteFailed')
    confirmDelete.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card :title="t('ingredients.edit.title')">
      <v-card-text class="d-flex flex-column ga-3">
        <v-text-field
          v-model="name"
          autocomplete="off"
          :label="t('ingredients.edit.name')"
          hide-details="auto"
          autofocus
          data-test="edit-name"
          @keydown.enter="onSave"
        />
        <p class="text-body-2 text-medium-emphasis">
          {{ t('ingredients.edit.renameHint') }}
        </p>
        <v-select
          v-model="categoryId"
          :items="categoryItems"
          :label="t('ingredients.edit.category')"
          clearable
          hide-details
          data-test="edit-category"
        />
        <v-select
          v-model="unit"
          :items="unitItems"
          item-props
          :label="t('ingredients.edit.unit')"
          clearable
          hide-details
          data-test="edit-unit"
        />
        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-btn v-if="!confirmDelete" color="error" variant="text" @click="confirmDelete = true">{{
          t('common.actions.delete')
        }}</v-btn>
        <v-btn v-else color="error" :loading="remove.isPending.value" @click="onDelete">{{
          t('ingredients.edit.reallyDelete')
        }}</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn color="primary" :loading="update.isPending.value" data-test="edit-save" @click="onSave">{{
          t('common.actions.save')
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
