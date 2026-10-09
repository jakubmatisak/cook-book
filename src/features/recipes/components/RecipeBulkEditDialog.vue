<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RECIPE_CATEGORIES, type RecipeCategory, type RecipeVisibility } from '@shared/recipes'
import { useBulkUpdateRecipes, type RecipeChange } from '@/api/bulk'
import { useTags } from '@/api/catalog'
import { useIsOwner } from '@/api/me'
import { useKidsEnabled } from '@/composables/useKidsEnabled'
import { errorText } from '@/i18n/errors'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
const props = defineProps<{ ids: readonly string[] }>()
const emit = defineEmits<{ saved: [affected: number] }>()

const isOwner = useIsOwner()
const kidsEnabled = useKidsEnabled()
const { data: tags } = useTags()
const save = useBulkUpdateRecipes()

const category = ref<RecipeCategory | null>(null)
const addTags = ref<string[]>([])
const addCategories = ref<RecipeCategory[]>([])
const removeCategories = ref<RecipeCategory[]>([])
const removeTags = ref<string[]>([])
const favorite = ref<'keep' | 'add' | 'remove'>('keep')
const verified = ref<'keep' | 'add' | 'remove'>('keep')
const visibility = ref<'keep' | RecipeVisibility>('keep')
const error = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  category.value = null
  addTags.value = []
  removeTags.value = []
  addCategories.value = []
  removeCategories.value = []
  favorite.value = 'keep'
  verified.value = 'keep'
  visibility.value = 'keep'
  error.value = ''
  save.reset()
})

const categoryItems = computed(() =>
  RECIPE_CATEGORIES.filter((c) => kidsEnabled.value || c !== 'detske').map((value) => ({
    value,
    title: t(`common.category.${value}`),
  })),
)
const tagNames = computed(() => tags.value?.map((tag) => tag.name) ?? [])

/** Len vyplnené polia; prázdne nechajú recepty tak, ako sú. */
const change = computed<RecipeChange>(() => ({
  ...(category.value ? { category: category.value } : {}),
  ...(addCategories.value.length ? { addCategories: addCategories.value } : {}),
  ...(removeCategories.value.length ? { removeCategories: removeCategories.value } : {}),
  ...(addTags.value.length ? { addTags: addTags.value } : {}),
  ...(removeTags.value.length ? { removeTags: removeTags.value } : {}),
  ...(favorite.value !== 'keep' ? { favorite: favorite.value === 'add' } : {}),
  ...(verified.value !== 'keep' ? { verified: verified.value === 'add' } : {}),
  ...(isOwner.value && visibility.value !== 'keep' ? { visibility: visibility.value } : {}),
}))
const empty = computed(() => Object.keys(change.value).length === 0)

async function submit() {
  if (empty.value) {
    error.value = t('bulk.nothingToChange')
    return
  }
  try {
    const affected = await save.mutateAsync({ ids: props.ids, change: change.value })
    open.value = false
    emit('saved', affected)
  } catch (e) {
    error.value = errorText(e, 'bulk.recipes.updateFailed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="520" :persistent="save.isPending.value">
    <v-card :title="t('bulk.recipes.editTitle')" data-test="bulk-edit-dialog">
      <v-card-text class="d-flex flex-column ga-4">
        <p class="text-body-medium text-medium-emphasis">
          {{ t('bulk.recipes.editHint', { recipes: ids.length }) }}
        </p>
        <v-alert v-if="error" type="error" density="compact" :text="error" />
        <v-select
          v-model="category"
          :items="categoryItems"
          :label="t('bulk.recipes.category')"
          :placeholder="t('bulk.keep')"
          clearable
          hide-details
          data-test="bulk-category"
        />
        <v-select
          v-model="addCategories"
          :items="categoryItems"
          :label="t('bulk.recipes.addCategories')"
          multiple
          chips
          closable-chips
          hide-details
          data-test="bulk-add-categories"
        />
        <v-select
          v-model="removeCategories"
          :items="categoryItems"
          :label="t('bulk.recipes.removeCategories')"
          multiple
          chips
          closable-chips
          hide-details
          data-test="bulk-remove-categories"
        />
        <v-combobox
          v-model="addTags"
          :items="tagNames"
          :label="t('bulk.recipes.addTags')"
          multiple
          chips
          closable-chips
          hide-details
          autocomplete="off"
          data-test="bulk-add-tags"
        />
        <v-autocomplete
          v-model="removeTags"
          :items="tagNames"
          :label="t('bulk.recipes.removeTags')"
          multiple
          chips
          closable-chips
          hide-details
          data-test="bulk-remove-tags"
        />
        <div>
          <div class="text-body-small text-medium-emphasis mb-1">{{ t('bulk.recipes.favorite') }}</div>
          <v-btn-toggle
            v-model="favorite"
            mandatory
            selected-class="bg-primary"
            variant="outlined"
            divided
            data-test="bulk-favorite"
          >
            <v-btn value="keep">{{ t('bulk.keep') }}</v-btn>
            <v-btn value="add">{{ t('bulk.recipes.favoriteAdd') }}</v-btn>
            <v-btn value="remove">{{ t('bulk.recipes.favoriteRemove') }}</v-btn>
          </v-btn-toggle>
        </div>
        <div>
          <div class="text-body-small text-medium-emphasis mb-1">{{ t('bulk.recipes.verified') }}</div>
          <v-btn-toggle
            v-model="verified"
            mandatory
            selected-class="bg-primary"
            variant="outlined"
            divided
            data-test="bulk-verified"
          >
            <v-btn value="keep">{{ t('bulk.keep') }}</v-btn>
            <v-btn value="add">{{ t('bulk.recipes.verifiedAdd') }}</v-btn>
            <v-btn value="remove">{{ t('bulk.recipes.verifiedRemove') }}</v-btn>
          </v-btn-toggle>
        </div>
        <div v-if="isOwner">
          <div class="text-body-small text-medium-emphasis mb-1">{{ t('bulk.recipes.visibility') }}</div>
          <v-btn-toggle
            v-model="visibility"
            mandatory
            selected-class="bg-primary"
            variant="outlined"
            divided
            data-test="bulk-visibility"
          >
            <v-btn value="keep">{{ t('bulk.keep') }}</v-btn>
            <v-btn value="private">{{ t('bulk.recipes.private') }}</v-btn>
            <v-btn value="public">{{ t('bulk.recipes.public') }}</v-btn>
          </v-btn-toggle>
        </div>
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
