<script setup lang="ts">
import { mdiAutoFix } from '@mdi/js'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IngredientDto, ShopCategoryDto } from '@shared/api'
import { suggestShopCategory } from '@shared/shopCategorySuggest'
import { useBulkUpdateIngredients } from '@/api/bulk'
import { apiFetch } from '@/api/http'
import { errorText } from '@/i18n/errors'
import { shopCategoryName } from '@/i18n/defaults'
import { tc } from '@/i18n/format'

/**
 * Návrh kategórie obchodu pre nezaradené ingrediencie (podľa názvu). Ukáže len tie, pri ktorých si je istý;
 * človek návrhy skontroluje, zmení alebo odznačí a zaradí naraz.
 */
const props = defineProps<{ ingredients: IngredientDto[] }>()
const emit = defineEmits<{ done: [message: string, color?: string] }>()
const { t } = useI18n()
// Pôvodné (slovenské) názvy kategórií – návrh ich porovnáva s pravidlami, preklad je len na zobrazenie.
const { data: categories } = useQuery({
  queryKey: ['shop-categories'],
  queryFn: () => apiFetch<ShopCategoryDto[]>('/shop-categories'),
  staleTime: 5 * 60_000,
})
const bulkUpdate = useBulkUpdateIngredients()

const suggestions = computed(() =>
  (categories.value ?? []).length
    ? props.ingredients.flatMap((i) => {
        if (i.shopCategoryId) return []
        const categoryId = suggestShopCategory(i.name, categories.value ?? [])
        return categoryId ? [{ ingredient: i, categoryId }] : []
      })
    : [],
)
const categoryItems = computed(() =>
  (categories.value ?? []).map((c) => ({ title: shopCategoryName(c.name), value: c.id })),
)

const open = ref(false)
const chosen = ref<Record<string, string | null>>({})
const checked = ref<string[]>([])
watch(open, (value) => {
  if (!value) return
  chosen.value = Object.fromEntries(suggestions.value.map((s) => [s.ingredient.id, s.categoryId]))
  checked.value = suggestions.value.map((s) => s.ingredient.id)
})

const toggle = (id: string) =>
  (checked.value = checked.value.includes(id)
    ? checked.value.filter((c) => c !== id)
    : [...checked.value, id])

async function apply() {
  const byCategory = new Map<string, string[]>()
  for (const id of checked.value) {
    const categoryId = chosen.value[id]
    if (categoryId) byCategory.set(categoryId, [...(byCategory.get(categoryId) ?? []), id])
  }
  try {
    let affected = 0
    for (const [shopCategoryId, ids] of byCategory) {
      affected += await bulkUpdate.mutateAsync({ ids, change: { shopCategoryId } })
    }
    open.value = false
    emit('done', t('ingredients.categorySuggest.done', { items: tc('ingredients.count', affected) }))
  } catch (e) {
    emit('done', errorText(e), 'error')
  }
}
</script>

<template>
  <v-btn
    v-if="suggestions.length"
    variant="tonal"
    :prepend-icon="mdiAutoFix"
    data-test="suggest-categories"
    @click="open = true"
  >
    {{ t('ingredients.categorySuggest.button', { n: suggestions.length }) }}
  </v-btn>

  <v-dialog v-model="open" max-width="640" scrollable>
    <v-card :title="t('ingredients.categorySuggest.title')">
      <v-card-text class="d-flex flex-column ga-2">
        <p class="text-body-medium text-medium-emphasis">{{ t('ingredients.categorySuggest.text') }}</p>
        <div
          v-for="s in suggestions"
          :key="s.ingredient.id"
          class="d-flex flex-wrap align-center ga-2"
          data-test="category-suggestion"
        >
          <v-checkbox-btn
            class="flex-grow-0"
            :model-value="checked.includes(s.ingredient.id)"
            color="primary"
            :aria-label="s.ingredient.name"
            :data-test="`category-suggestion-${s.ingredient.id}`"
            @update:model-value="toggle(s.ingredient.id)"
          />
          <span class="flex-grow-1 text-start" style="min-width: 160px">{{ s.ingredient.name }}</span>
          <v-select
            v-model="chosen[s.ingredient.id]"
            :items="categoryItems"
            :aria-label="t('ingredients.page.shopCategory')"
            density="compact"
            hide-details
            class="flex-grow-0 flex-shrink-0"
            style="width: 260px"
          />
        </div>
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn
          color="primary"
          :disabled="!checked.length"
          :loading="bulkUpdate.isPending.value"
          data-test="category-suggest-apply"
          @click="apply"
        >
          {{ t('ingredients.categorySuggest.apply', { n: checked.length }) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
