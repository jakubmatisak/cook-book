<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { UNITS, type UnitCode } from '@shared/units'
import { useCreateIngredient, useShopCategories, useTogglePantry } from '@/api/catalog'
import { errorText } from '@/i18n/errors'
import { unitText } from '@/i18n/quantity'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
/** Predvyplnený názov (napr. z hľadania, ktoré nič nenašlo). */
const props = defineProps<{ initialName?: string }>()

const name = ref('')
const categoryId = ref<string | null>(null)
const unit = ref<UnitCode | null>(null)
const atHome = ref(true)
const error = ref('')

const { data: categories } = useShopCategories()
const create = useCreateIngredient()
const toggle = useTogglePantry()

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = props.initialName ?? ''
  categoryId.value = null
  unit.value = null
  atHome.value = true
  error.value = ''
  create.reset()
})

const categoryItems = computed(() => categories.value?.map((c) => ({ title: c.name, value: c.id })) ?? [])
const unitItems = computed(() =>
  UNITS.map((u) => ({ title: unitText(u.code), value: u.code, subtitle: t(`common.unit.${u.code}`) })),
)

async function save() {
  const trimmed = name.value.trim()
  if (!trimmed) return void (error.value = t('pantry.new.nameRequired'))
  try {
    const created = await create.mutateAsync({
      name: trimmed,
      shopCategoryId: categoryId.value,
      defaultUnit: unit.value,
    })
    // Nová surovina sa rovno označí, že ju mám doma (ak to nevypnem).
    if (atHome.value) await toggle.mutateAsync({ ingredientId: created.id, inPantry: true })
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'pantry.new.saveFailed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="460" :persistent="create.isPending.value">
    <v-card :title="t('pantry.new.title')">
      <v-card-text class="d-flex flex-column ga-4">
        <p class="text-body-medium text-medium-emphasis">{{ t('pantry.new.intro') }}</p>
        <v-alert v-if="error" type="error" density="compact" :text="error" />
        <v-text-field
          v-model="name"
          :label="t('pantry.new.name')"
          autocomplete="off"
          autofocus
          hide-details="auto"
          data-test="new-name"
          @keydown.enter.prevent="save"
        />
        <v-select
          v-model="categoryId"
          :items="categoryItems"
          :label="t('pantry.new.category')"
          clearable
          hide-details
          data-test="new-category"
        />
        <v-select
          v-model="unit"
          :items="unitItems"
          item-props
          :label="t('pantry.new.unit')"
          clearable
          hide-details
          data-test="new-unit"
        />
        <v-checkbox v-model="atHome" :label="t('pantry.new.atHome')" hide-details data-test="new-at-home" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="create.isPending.value" @click="open = false">{{
          t('common.actions.cancel')
        }}</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="create.isPending.value"
          data-test="new-save"
          @click="save"
        >
          {{ t('common.actions.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
