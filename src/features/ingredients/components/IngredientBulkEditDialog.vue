<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { UNITS, type UnitCode } from '@shared/units'
import { useBulkUpdateIngredients, type IngredientChange } from '@/api/bulk'
import { useShopCategories } from '@/api/catalog'
import { errorText } from '@/i18n/errors'
import { unitText } from '@/i18n/quantity'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
const props = defineProps<{ ids: readonly string[] }>()
const emit = defineEmits<{ saved: [affected: number] }>()

const { data: categories } = useShopCategories()
const save = useBulkUpdateIngredients()

// `undefined` = nemeniť, `null` = vymazať (bez kategórie / bez jednotky), inak nová hodnota.
const NONE = '__none__'
const shopCategory = ref<string | undefined>(undefined)
const unit = ref<string | undefined>(undefined)
const error = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  shopCategory.value = undefined
  unit.value = undefined
  error.value = ''
  save.reset()
})

const categoryItems = computed(() => [
  { title: t('bulk.ingredients.noCategory'), value: NONE },
  ...(categories.value?.map((c) => ({ title: c.name, value: c.id })) ?? []),
])
const unitItems = computed(() => [
  { title: t('bulk.ingredients.noUnit'), value: NONE },
  ...UNITS.map((u) => ({ title: unitText(u.code), value: u.code, subtitle: t(`common.unit.${u.code}`) })),
])

const change = computed<IngredientChange>(() => ({
  ...(shopCategory.value !== undefined
    ? { shopCategoryId: shopCategory.value === NONE ? null : shopCategory.value }
    : {}),
  ...(unit.value !== undefined ? { defaultUnit: unit.value === NONE ? null : (unit.value as UnitCode) } : {}),
}))

async function submit() {
  if (Object.keys(change.value).length === 0) {
    error.value = t('bulk.nothingToChange')
    return
  }
  try {
    const affected = await save.mutateAsync({ ids: props.ids, change: change.value })
    open.value = false
    emit('saved', affected)
  } catch (e) {
    error.value = errorText(e, 'bulk.ingredients.updateFailed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="480" :persistent="save.isPending.value">
    <v-card :title="t('bulk.ingredients.editTitle')" data-test="bulk-edit-dialog">
      <v-card-text class="d-flex flex-column ga-4">
        <p class="text-body-2 text-medium-emphasis">
          {{ t('bulk.ingredients.editHint', { items: ids.length }) }}
        </p>
        <v-alert v-if="error" type="error" density="compact" :text="error" />
        <v-select
          v-model="shopCategory"
          :items="categoryItems"
          :label="t('bulk.ingredients.shopCategory')"
          :placeholder="t('bulk.keep')"
          clearable
          hide-details
          data-test="bulk-shop-category"
        />
        <v-select
          v-model="unit"
          :items="unitItems"
          item-props
          :label="t('bulk.ingredients.unit')"
          :placeholder="t('bulk.keep')"
          clearable
          hide-details
          data-test="bulk-unit"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="save.isPending.value" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="save.isPending.value"
          data-test="bulk-apply"
          @click="submit"
        >
          {{ t('bulk.apply') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
