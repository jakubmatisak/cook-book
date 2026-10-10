<script setup lang="ts">
import {
  mdiAccountMultipleOutline,
  mdiArrowLeft,
  mdiCalendarPlus,
  mdiLinkVariant,
  mdiPlaylistPlus,
  mdiPotSteamOutline,
} from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/http'
import { useCopyPublicRecipe, usePublicRecipe } from '@/api/publicRecipes'
import EmptyState from '@/components/EmptyState.vue'
import RecipeCover from '../components/RecipeCover.vue'
import RecipeIngredientsSteps from '../components/RecipeIngredientsSteps.vue'
import { useRecipeChips } from '../recipeChips'
import { usePrintMode } from '@/composables/usePrintMode'
import { errorText } from '@/i18n/errors'
import { addDays } from '@shared/dates'
import { useMe } from '@/api/me'
import { useToday } from '@/composables/useToday'
import EntryDialog from '@/features/meal-plan/components/EntryDialog.vue'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const { data: recipe, isPending, error } = usePublicRecipe(id)
const copy = useCopyPublicRecipe()

const notFound = computed(() => error.value instanceof ApiError && error.value.status === 404)

watch(
  [recipe, locale],
  ([r]) => {
    if (r) document.title = `${r.title} · ${t('common.app.name')}`
  },
  { immediate: true },
)

const chips = useRecipeChips(recipe)
// Pri tlači kompaktne ako detail receptu: menší nadpis, štítky a popis.
const printing = usePrintMode()

const snackbar = ref({ show: false, text: '', color: 'success', recipeId: '' })

async function addToMine() {
  try {
    const created = await copy.mutateAsync(id.value)
    snackbar.value = {
      show: true,
      text: t('publicRecipes.detail.copied'),
      color: 'success',
      recipeId: created.id,
    }
  } catch (e) {
    snackbar.value = { show: true, text: errorText(e), color: 'error', recipeId: '' }
  }
}

const openCopy = () => router.push(`/recipes/${snackbar.value.recipeId}`)

// Zdieľaný recept sa do plánu pridáva cez vlastnú kópiu (originál môže odosielateľ kedykoľvek prestať zdieľať).
const { data: me } = useMe()
const today = useToday()
const planDates = computed(() => Array.from({ length: 14 }, (_, i) => addDays(today.value, i)))
const defaultSlotId = computed(
  () =>
    me.value?.slots.find((s) => s.name === 'Obed' && s.isEnabled)?.id ??
    me.value?.slots.find((s) => s.isEnabled)?.id ??
    '',
)
const planRecipeId = ref<string | null>(null)
const planOpen = ref(false)
const planning = ref(false)
async function addToPlan() {
  planning.value = true
  try {
    const created = await copy.mutateAsync(id.value)
    planRecipeId.value = created.id
    planOpen.value = true
  } catch (e) {
    snackbar.value = {
      show: true,
      text: errorText(e, 'sharing.recipe.copyFailed'),
      color: 'error',
      recipeId: '',
    }
  } finally {
    planning.value = false
  }
}
const backTo = computed(() =>
  recipe.value?.sharedFrom
    ? { path: '/recipes', query: { shared: 'with-me' } }
    : { path: '/recipes', query: { public: 'only' } },
)
</script>

<template>
  <div class="d-flex align-center mb-2 d-print-none">
    <v-btn
      :icon="mdiArrowLeft"
      variant="text"
      :aria-label="t('common.actions.back')"
      @click="router.push(backTo)"
    />
  </div>

  <v-skeleton-loader v-if="isPending" type="article" />
  <EmptyState
    v-else-if="notFound"
    :icon="mdiPotSteamOutline"
    :title="t('publicRecipes.detail.notFound.title')"
    :text="t('publicRecipes.detail.notFound.text')"
  >
    <v-btn color="primary" :to="{ path: '/recipes', query: { public: 'only' } }">{{
      t('publicRecipes.detail.notFound.back')
    }}</v-btn>
  </EmptyState>
  <v-alert v-else-if="error" type="error" :text="errorText(error)" />

  <template v-else-if="recipe">
    <RecipeCover v-if="recipe.coverImageUrl" :src="recipe.coverImageUrl" />

    <h1 class="font-weight-bold mb-1" :class="printing ? 'text-headline-small' : 'text-headline-large'">
      {{ recipe.title }}
    </h1>
    <div v-if="recipe.sharedFrom" class="mb-3">
      <v-chip
        color="primary"
        variant="tonal"
        size="small"
        :prepend-icon="mdiAccountMultipleOutline"
        to="/sharing"
        data-test="shared-from"
      >
        {{ t('sharing.recipe.sharedFrom', { name: recipe.sharedFrom }) }}
      </v-chip>
    </div>
    <p v-else class="text-body-medium text-medium-emphasis mb-3" data-test="public-author">
      {{ t('publicRecipes.detail.from', { name: recipe.householdName }) }}
    </p>
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

    <div class="d-flex flex-wrap ga-2 mb-4 d-print-none">
      <v-alert
        v-if="recipe.ownedByMe"
        type="info"
        density="compact"
        class="flex-grow-1"
        data-test="public-mine"
      >
        {{ t('publicRecipes.detail.alreadyMine') }}
        <v-btn variant="text" size="small" :to="`/recipes/${recipe.id}`">
          {{ t('publicRecipes.detail.openMine') }}
        </v-btn>
      </v-alert>
      <v-btn
        v-else
        color="primary"
        :prepend-icon="mdiPlaylistPlus"
        :loading="copy.isPending.value"
        data-test="public-copy"
        @click="addToMine"
      >
        {{ t('publicRecipes.detail.copy') }}
      </v-btn>
      <v-btn
        v-if="!recipe.ownedByMe"
        variant="outlined"
        :prepend-icon="mdiCalendarPlus"
        :loading="planning"
        data-test="shared-plan"
        @click="addToPlan"
      >
        {{ t('sharing.recipe.addToPlan') }}
      </v-btn>
    </div>

    <p
      v-if="recipe.description"
      class="text-pre-line text-justify"
      :class="printing ? 'text-body-medium mb-2' : 'text-body-large mb-3'"
      data-test="recipe-description"
    >
      {{ recipe.description }}
    </p>
    <p v-if="recipe.sourceUrl" class="mb-4">
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
  </template>

  <EntryDialog
    v-if="me && planRecipeId"
    v-model="planOpen"
    :entry="null"
    :initial-date="today"
    :initial-slot-id="defaultSlotId"
    :initial-recipe-id="planRecipeId"
    :slots="me.slots"
    :dates="planDates"
    :members="me.members"
  />

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="6000">
    {{ snackbar.text }}
    <template v-if="snackbar.recipeId" #actions>
      <v-btn variant="text" data-test="public-open-copy" @click="openCopy">
        {{ t('publicRecipes.detail.open') }}
      </v-btn>
    </template>
  </v-snackbar>
</template>
