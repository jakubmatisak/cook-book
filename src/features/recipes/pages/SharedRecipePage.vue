<script setup lang="ts">
import { mdiLinkVariant, mdiLinkVariantOff, mdiPrinterOutline } from '@mdi/js'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ApiError } from '@/api/http'
import { useSharedRecipe } from '@/api/shared'
import EmptyState from '@/components/EmptyState.vue'
import { printPage, usePrintMode } from '@/composables/usePrintMode'
import { errorText } from '@/i18n/errors'
import RecipeCover from '../components/RecipeCover.vue'
import RecipeIngredientsSteps from '../components/RecipeIngredientsSteps.vue'
import { useRecipeChips } from '../recipeChips'

/** Recept otvorený odkazom na zdieľanie: bez menu a prihlásenia, s tlačidlom na tlač. */
const { t, locale } = useI18n()
const route = useRoute()
const token = computed(() => String(route.params.token))
const { data: recipe, isPending, error } = useSharedRecipe(token)
const chips = useRecipeChips(recipe)
// Pri tlači kompaktne ako detail receptu: menší nadpis, štítky a popis.
const printing = usePrintMode()

const notFound = computed(() => error.value instanceof ApiError && error.value.status === 404)

watch(
  [recipe, locale],
  ([r]) => {
    if (r) document.title = `${r.title} · ${t('common.app.name')}`
  },
  { immediate: true },
)
</script>

<template>
  <div class="d-flex align-center ga-2 mb-4 d-print-none">
    <span class="text-title-medium font-weight-bold me-auto">{{ t('common.app.name') }}</span>
    <v-btn
      v-if="recipe"
      color="primary"
      variant="tonal"
      :prepend-icon="mdiPrinterOutline"
      data-test="shared-print"
      @click="printPage()"
    >
      {{ t('common.actions.print') }}
    </v-btn>
  </div>

  <v-skeleton-loader v-if="isPending" type="image, heading, paragraph, paragraph" />
  <EmptyState
    v-else-if="notFound"
    :icon="mdiLinkVariantOff"
    :title="t('recipes.shared.notFoundTitle')"
    :text="t('recipes.shared.notFoundText')"
  />
  <v-alert v-else-if="error" type="error" :text="errorText(error)" />

  <template v-else-if="recipe">
    <RecipeCover v-if="recipe.coverImageUrl" :src="recipe.coverImageUrl" />

    <h1 class="font-weight-bold" :class="printing ? 'text-headline-small mb-1' : 'text-headline-large mb-3'">
      {{ recipe.title }}
    </h1>
    <div class="d-flex flex-wrap ga-2" :class="printing ? 'mb-2' : 'mb-3'">
      <v-chip
        v-for="chip in chips"
        :key="chip.text"
        :size="printing ? 'x-small' : 'small'"
        :prepend-icon="chip.icon"
        :color="chip.color"
        :variant="chip.color ? 'tonal' : 'outlined'"
      >
        {{ chip.text }}
      </v-chip>
    </div>
    <p
      v-if="recipe.description"
      class="text-pre-line text-justify"
      :class="printing ? 'text-body-medium mb-2' : 'text-body-large mb-3'"
      data-test="recipe-description"
    >
      {{ recipe.description }}
    </p>
    <p v-if="recipe.sourceUrl" class="mb-4 d-print-none">
      <v-btn
        variant="text"
        size="small"
        :prepend-icon="mdiLinkVariant"
        :href="recipe.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t('publicRecipes.detail.source') }}
      </v-btn>
    </p>

    <!-- Ukončí obtekanie titulnej fotky, aby ingrediencie a postup boli pod hlavičkou. -->
    <div style="clear: both" />
    <RecipeIngredientsSteps :ingredients="recipe.ingredients" :steps="recipe.steps" />
    <p v-if="recipe.sourceText" class="text-body-small text-medium-emphasis mt-3">
      {{ t('recipes.shared.source', { source: recipe.sourceText }) }}
    </p>
  </template>
</template>
