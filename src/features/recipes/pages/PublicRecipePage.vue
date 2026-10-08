<script setup lang="ts">
import {
  mdiArrowLeft,
  mdiChefHat,
  mdiClockOutline,
  mdiLinkVariant,
  mdiPlaylistPlus,
  mdiPotSteamOutline,
  mdiSilverwareForkKnife,
} from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { RecipeIngredientDto } from '@shared/api'
import { ApiError } from '@/api/http'
import { useCopyPublicRecipe, usePublicRecipe } from '@/api/publicRecipes'
import EmptyState from '@/components/EmptyState.vue'
import RecipeCover from '../components/RecipeCover.vue'
import { errorText } from '@/i18n/errors'
import { formatMinutes, tc } from '@/i18n/format'
import { formatQuantity, quantityColumnWidth } from '@/i18n/quantity'

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

const groups = computed(() => {
  const map = new Map<string, RecipeIngredientDto[]>()
  for (const item of recipe.value?.ingredients ?? []) {
    const key = item.groupName ?? ''
    map.set(key, [...(map.get(key) ?? []), item])
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }))
})

const quantityWidth = computed(() =>
  quantityColumnWidth(
    (recipe.value?.ingredients ?? []).map((item) => formatQuantity(item.quantity, item.unit)),
  ),
)

const suffix = (item: RecipeIngredientDto) =>
  (item.note ? `, ${item.note}` : '') + (item.isOptional ? ` (${t('recipes.detail.optional')})` : '')

interface Chip {
  icon?: string
  text: string
  color?: string
}
const chips = computed<Chip[]>(() => {
  const r = recipe.value
  if (!r) return []
  const list: Chip[] = [{ text: t(`common.category.${r.category}`), color: 'primary' }]
  if (r.prepMinutes !== null)
    list.push({
      icon: mdiClockOutline,
      text: t('recipes.detail.prep', { time: formatMinutes(r.prepMinutes) }),
    })
  if (r.cookMinutes !== null)
    list.push({
      icon: mdiPotSteamOutline,
      text: t('recipes.detail.cook', { time: formatMinutes(r.cookMinutes) }),
    })
  list.push({ icon: mdiSilverwareForkKnife, text: tc('common.plural.portions', r.servings) })
  list.push({ icon: mdiChefHat, text: t(`common.difficulty.${r.difficulty}`) })
  return list
})

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
</script>

<template>
  <div class="d-flex align-center mb-2 d-print-none">
    <v-btn
      :icon="mdiArrowLeft"
      variant="text"
      :aria-label="t('common.actions.back')"
      @click="router.push({ path: '/recipes', query: { public: 'only' } })"
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

    <h1 class="text-headline-large font-weight-bold mb-1">{{ recipe.title }}</h1>
    <p class="text-body-medium text-medium-emphasis mb-3" data-test="public-author">
      {{ t('publicRecipes.detail.from', { name: recipe.householdName }) }}
    </p>
    <div class="d-flex flex-wrap ga-2 mb-3">
      <v-chip
        v-for="chip in chips"
        :key="chip.text"
        size="small"
        :prepend-icon="chip.icon"
        :color="chip.color"
        :variant="chip.color ? 'tonal' : 'outlined'"
      >
        {{ chip.text }}
      </v-chip>
    </div>

    <div class="d-flex flex-wrap ga-2 mb-4">
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
    </div>

    <p
      v-if="recipe.description"
      class="text-body-large mb-3 text-pre-line text-justify"
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
    <v-row>
      <v-col cols="12" md="5" lg="4">
        <v-card :title="t('recipes.detail.ingredients')">
          <v-card-text v-if="!recipe.ingredients.length" class="text-medium-emphasis">
            {{ t('recipes.detail.noIngredients') }}
          </v-card-text>
          <v-list density="compact" class="py-0 pb-2">
            <template v-for="group in groups" :key="group.name">
              <v-list-subheader v-if="group.name" class="text-primary font-weight-bold">
                {{ group.name }}
              </v-list-subheader>
              <v-list-item v-for="item in group.items" :key="item.id">
                <template #prepend>
                  <span
                    class="font-weight-bold text-no-wrap me-3"
                    :style="{ minWidth: quantityWidth }"
                    data-test="ingredient-quantity"
                  >
                    {{ formatQuantity(item.quantity, item.unit) }}
                  </span>
                </template>
                <v-list-item-title class="text-wrap">
                  {{ item.name }}<span class="text-medium-emphasis">{{ suffix(item) }}</span>
                </v-list-item-title>
              </v-list-item>
            </template>
          </v-list>
        </v-card>
      </v-col>
      <v-col cols="12" md="7" lg="8">
        <v-card :title="t('recipes.detail.steps')">
          <v-list lines="three" class="py-0 pb-2">
            <v-list-item v-for="step in recipe.steps" :key="step.id" class="py-3">
              <template #prepend>
                <v-avatar color="primary" size="32" class="font-weight-bold">{{
                  step.position + 1
                }}</v-avatar>
              </template>
              <v-list-item-title class="text-wrap text-body-large text-pre-line">
                {{ step.text }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </template>

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="6000">
    {{ snackbar.text }}
    <template v-if="snackbar.recipeId" #actions>
      <v-btn variant="text" data-test="public-open-copy" @click="openCopy">
        {{ t('publicRecipes.detail.open') }}
      </v-btn>
    </template>
  </v-snackbar>
</template>
