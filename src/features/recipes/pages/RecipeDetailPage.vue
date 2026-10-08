<script setup lang="ts">
import {
  mdiArrowLeft,
  mdiChefHat,
  mdiCheckCircle,
  mdiClockOutline,
  mdiCalendarPlus,
  mdiDeleteOutline,
  mdiContentCopy,
  mdiDotsVertical,
  mdiEarth,
  mdiEarthOff,
  mdiFileDownloadOutline,
  mdiLinkVariant,
  mdiPencilOutline,
  mdiPlayCircleOutline,
  mdiPotSteamOutline,
  mdiPrinterOutline,
  mdiShareVariantOutline,
  mdiSilverwareForkKnife,
  mdiTimerOutline,
} from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { RecipeIngredientDto } from '@shared/api'
import { addDays } from '@shared/dates'
import { formatScaled, quantityColumnWidth } from '@/i18n/quantity'
import { markdownFilename, recipeToMarkdown } from '@shared/markdown'
import { ApiError, downloadFile } from '@/api/http'
import { useIsOwner, useMe } from '@/api/me'
import { useDeleteRecipe, useRecipe } from '@/api/recipes'
import { canShare, copyText, shareText } from '@/composables/useShare'
import { useToday } from '@/composables/useToday'
import EntryDialog from '@/features/meal-plan/components/EntryDialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import { printPage, usePrintMode } from '@/composables/usePrintMode'
import { errorText } from '@/i18n/errors'
import { formatMinutes, tc } from '@/i18n/format'
import FavoriteButton from '../components/FavoriteButton.vue'
import VisibilityDialog from '../components/VisibilityDialog.vue'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const { data: recipe, isPending, error } = useRecipe(id)
const remove = useDeleteRecipe()

const notFound = computed(() => error.value instanceof ApiError && error.value.status === 404)

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
    (recipe.value?.ingredients ?? []).map((item) => formatScaled(item.quantity, factor.value, item.unit)),
  ),
)

const ingredientSuffix = (item: RecipeIngredientDto) =>
  (item.note ? `, ${item.note}` : '') + (item.isOptional ? ` (${t('recipes.detail.optional')})` : '')

watch(
  [recipe, locale],
  ([r]) => {
    if (r) document.title = `${r.title} · ${t('common.app.name')}`
  },
  { immediate: true },
)

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
  if (r.visibility === 'public') list.push({ icon: mdiEarth, text: t('publicRecipes.visibility.chip') })
  return list
})

const { data: me } = useMe()
const today = useToday()
const planOpen = ref(false)

// Zverejnenie receptu (len vlastník domácnosti): verejný recept vidia a kopírujú všetci prihlásení.
const isOwner = useIsOwner()
const visibilityOpen = ref(false)
const planDates = computed(() => Array.from({ length: 14 }, (_, i) => addDays(today.value, i)))
const defaultSlotId = computed(
  () =>
    me.value?.slots.find((s) => s.name === 'Obed' && s.isEnabled)?.id ??
    me.value?.slots.find((s) => s.isEnabled)?.id ??
    '',
)

/** Počet porcií v prepočte; žije v URL (?porcie=), aby ho prevzal aj režim varenia. */
const servings = computed({
  get: () => {
    const fromUrl = Number(route.query.servings)
    return Number.isFinite(fromUrl) && fromUrl >= 1 && fromUrl <= 50 ? fromUrl : (recipe.value?.servings ?? 4)
  },
  set: (value: number | null | undefined) => {
    const query = { ...route.query }
    if (value && value !== recipe.value?.servings) query.servings = String(value)
    else delete query.servings
    void router.replace({ query })
  },
})
const factor = computed(() => (recipe.value ? servings.value / recipe.value.servings : 1))
const cookingLink = computed(() => ({
  path: `/recipes/${id.value}/cook`,
  query: route.query.servings ? { servings: String(route.query.servings) } : {},
}))

// Tlač, kopírovanie, zdieľanie a export: s aktuálne zvoleným počtom porcií
const snackbar = ref({ show: false, text: '', color: 'success' })
const notify = (text: string, color = 'success') => (snackbar.value = { show: true, text, color })
const markdown = computed(() =>
  recipe.value ? recipeToMarkdown(recipe.value, { servings: servings.value }) : '',
)
const supportsShare = canShare()

const printRecipe = () => printPage()
// Pri tlači je recept kompaktný: menší nadpis, suroviny a postup vedľa seba, kroky bez veľkých medzier.
const printing = usePrintMode()

async function copyRecipe() {
  const copied = await copyText(markdown.value)
  notify(copied ? t('recipes.detail.copied') : t('recipes.detail.copyFailed'), copied ? 'success' : 'error')
}

async function shareRecipe() {
  if (!recipe.value) return
  try {
    await shareText({ title: recipe.value.title, text: markdown.value })
  } catch (e) {
    notify(errorText(e, 'recipes.detail.shareFailed'), 'error')
  }
}

async function downloadMarkdown() {
  if (!recipe.value) return
  const query = servings.value !== recipe.value.servings ? `?servings=${servings.value}` : ''
  try {
    await downloadFile(`/recipes/${id.value}/export.md${query}`, markdownFilename(recipe.value.title))
  } catch (e) {
    notify(errorText(e, 'recipes.detail.downloadFailed'), 'error')
  }
}

const confirmDelete = ref(false)
const deleteError = ref('')

async function onDelete() {
  deleteError.value = ''
  try {
    await remove.mutateAsync(id.value)
    confirmDelete.value = false
    await router.replace('/recipes')
  } catch (e) {
    deleteError.value = errorText(e, 'recipes.detail.deleteFailed')
  }
}

function goBack() {
  if (window.history.state?.back) router.back()
  else void router.push('/recipes')
}
</script>

<template>
  <v-toolbar color="transparent" density="compact" class="mb-2 px-0 d-print-none">
    <v-btn :icon="mdiArrowLeft" variant="text" :aria-label="t('common.actions.back')" @click="goBack" />
    <v-spacer />
    <template v-if="recipe">
      <FavoriteButton :recipe-id="recipe.id" :is-favorite="recipe.isFavorite" size="default" />
      <v-btn
        :icon="mdiPencilOutline"
        variant="text"
        :to="`/recipes/${recipe.id}/edit`"
        :aria-label="t('common.actions.edit')"
      />
      <v-btn
        :icon="mdiCalendarPlus"
        variant="text"
        :aria-label="t('recipes.detail.plan')"
        @click="planOpen = true"
      />
      <v-menu>
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            :icon="mdiDotsVertical"
            variant="text"
            :aria-label="t('recipes.detail.more')"
          />
        </template>
        <v-list>
          <v-list-item
            :prepend-icon="mdiPrinterOutline"
            :title="t('common.actions.print')"
            data-test="print"
            @click="printRecipe"
          />
          <v-list-item
            :prepend-icon="mdiContentCopy"
            :title="t('recipes.detail.copyText')"
            data-test="copy"
            @click="copyRecipe"
          />
          <v-list-item
            v-if="supportsShare"
            :prepend-icon="mdiShareVariantOutline"
            :title="t('recipes.detail.share')"
            data-test="share"
            @click="shareRecipe"
          />
          <v-list-item
            :prepend-icon="mdiFileDownloadOutline"
            :title="t('recipes.detail.downloadMd')"
            data-test="download-md"
            @click="downloadMarkdown"
          />
          <v-list-item
            v-if="isOwner"
            :prepend-icon="recipe.visibility === 'public' ? mdiEarthOff : mdiEarth"
            :title="
              recipe.visibility === 'public'
                ? t('publicRecipes.visibility.hide')
                : t('publicRecipes.visibility.publish')
            "
            data-test="visibility"
            @click="visibilityOpen = true"
          />
          <v-divider />
          <v-list-item
            :prepend-icon="mdiDeleteOutline"
            :title="t('recipes.detail.deleteRecipe')"
            @click="confirmDelete = true"
          />
        </v-list>
      </v-menu>
    </template>
  </v-toolbar>

  <v-skeleton-loader v-if="isPending" type="image, heading, paragraph, paragraph" />

  <EmptyState
    v-else-if="notFound"
    :icon="mdiPotSteamOutline"
    :title="t('recipes.detail.notFoundTitle')"
    :text="t('recipes.detail.notFoundText')"
  >
    <v-btn color="primary" to="/recipes">{{ t('recipes.detail.backToRecipes') }}</v-btn>
  </EmptyState>

  <v-alert v-else-if="error" type="error" :text="errorText(error)" />

  <template v-else-if="recipe">
    <v-img
      v-if="recipe.coverImageUrl"
      :src="recipe.coverImageUrl"
      :aspect-ratio="16 / 9"
      max-height="420"
      cover
      rounded="md"
      class="mb-4 d-print-none"
    />

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
    <v-btn
      color="primary"
      variant="tonal"
      :prepend-icon="mdiPlayCircleOutline"
      :to="cookingLink"
      class="mb-3 d-print-none"
    >
      {{ t('recipes.detail.cookingMode') }}
    </v-btn>
    <p
      v-if="recipe.description"
      class="text-pre-line"
      :class="printing ? 'text-body-medium mb-2' : 'text-body-large mb-3'"
    >
      {{ recipe.description }}
    </p>
    <div v-if="recipe.tags.length" class="d-flex flex-wrap ga-1 mb-4 d-print-none">
      <v-chip
        v-for="tag in recipe.tags"
        :key="tag.id"
        size="small"
        variant="tonal"
        :color="tag.color ?? 'secondary'"
        :to="{ path: '/recipes', query: { tag: tag.id } }"
      >
        #{{ tag.name }}
      </v-chip>
    </div>

    <v-row :density="printing ? 'compact' : undefined">
      <v-col :cols="printing ? 5 : 12" md="5" lg="4" data-test="recipe-ingredients-col">
        <v-card :title="t('recipes.detail.ingredients')" :border="!printing">
          <v-card-text class="d-none d-print-block pb-0">
            {{ t('recipes.detail.forPortions', { portions: tc('recipes.portionsAcc', servings) }) }}
          </v-card-text>
          <v-card-text class="d-flex align-center ga-3 pb-0 d-print-none">
            <v-number-input
              v-model="servings"
              :label="t('recipes.detail.servings')"
              :min="1"
              :max="50"
              control-variant="split"
              density="compact"
              hide-details
              style="max-width: 11rem"
            />
            <v-chip v-if="factor !== 1" size="small" variant="tonal" color="warning">
              {{ t('recipes.detail.originally', { n: recipe.servings }) }}
            </v-chip>
          </v-card-text>
          <v-card-text v-if="!recipe.ingredients.length" class="text-medium-emphasis">{{
            t('recipes.detail.noIngredients')
          }}</v-card-text>
          <v-list density="compact" class="py-0 pb-2">
            <template v-for="group in groups" :key="group.name">
              <v-list-subheader v-if="group.name" class="text-primary font-weight-bold">
                {{ group.name }}
              </v-list-subheader>
              <v-list-item v-for="item in group.items" :key="item.id" :min-height="printing ? 24 : undefined">
                <template #prepend>
                  <span
                    class="font-weight-bold text-no-wrap me-3"
                    :style="{ minWidth: quantityWidth }"
                    data-test="ingredient-quantity"
                  >
                    {{ formatScaled(item.quantity, factor, item.unit) }}
                  </span>
                </template>
                <v-list-item-title class="text-wrap">
                  {{ item.name }}<span class="text-medium-emphasis">{{ ingredientSuffix(item) }}</span>
                  <v-icon
                    v-if="item.inPantry"
                    :icon="mdiCheckCircle"
                    size="14"
                    color="success"
                    class="ms-1"
                    :title="t('recipes.detail.inPantry')"
                  />
                </v-list-item-title>
              </v-list-item>
            </template>
          </v-list>
        </v-card>
      </v-col>

      <v-col :cols="printing ? 7 : 12" md="7" lg="8" data-test="recipe-steps-col">
        <v-card :title="t('recipes.detail.steps')" :border="!printing">
          <v-card-text v-if="!recipe.steps.length" class="text-medium-emphasis">{{
            t('recipes.detail.noSteps')
          }}</v-card-text>
          <v-list v-else :lines="printing ? false : 'three'" class="py-0 pb-2">
            <v-list-item
              v-for="step in recipe.steps"
              :key="step.id"
              :class="printing ? 'py-1' : 'py-3'"
              data-test="recipe-step"
            >
              <template #prepend>
                <v-avatar color="primary" :size="printing ? 22 : 32" class="font-weight-bold me-3">{{
                  step.position
                }}</v-avatar>
              </template>
              <v-list-item-title
                class="text-wrap text-pre-line"
                :class="printing ? 'text-body-medium' : 'text-body-large'"
              >
                {{ step.text }}
              </v-list-item-title>
              <v-list-item-subtitle v-if="step.timerSeconds" class="mt-1">
                <v-chip size="x-small" :prepend-icon="mdiTimerOutline" variant="tonal">
                  {{ formatMinutes(Math.round(step.timerSeconds / 60)) }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card>

        <div v-if="recipe.sourceUrl || recipe.sourceText" class="text-body-medium text-medium-emphasis mt-4">
          {{ t('recipes.detail.source') }}
          <a
            v-if="recipe.sourceUrl"
            :href="recipe.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary"
          >
            <v-icon :icon="mdiLinkVariant" size="14" /> {{ recipe.sourceText || recipe.sourceUrl }}
          </a>
          <span v-else>{{ recipe.sourceText }}</span>
        </div>
      </v-col>
    </v-row>
  </template>

  <EntryDialog
    v-if="recipe && me"
    v-model="planOpen"
    :entry="null"
    :initial-date="today"
    :initial-slot-id="defaultSlotId"
    :initial-recipe-id="recipe.id"
    :slots="me.slots"
    :dates="planDates"
    :members="me.members"
  />

  <VisibilityDialog
    v-if="recipe"
    v-model="visibilityOpen"
    :recipe-id="recipe.id"
    :visibility="recipe.visibility"
    @done="notify"
    @failed="notify($event, 'error')"
  />

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">{{ snackbar.text }}</v-snackbar>

  <v-dialog v-model="confirmDelete" max-width="420">
    <v-card :title="t('recipes.detail.deleteTitle')">
      <v-card-text>
        {{ t('recipes.detail.deleteText', { title: recipe?.title ?? '' }) }}
        <v-alert v-if="deleteError" type="error" class="mt-3" :text="deleteError" />
      </v-card-text>
      <v-card-actions class="flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="confirmDelete = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn color="error" :loading="remove.isPending.value" @click="onDelete">{{
          t('common.actions.delete')
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
