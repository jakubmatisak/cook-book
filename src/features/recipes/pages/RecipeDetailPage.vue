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
import { useRoute, useRouter } from 'vue-router'
import type { RecipeIngredientDto } from '@shared/api'
import { addDays } from '@shared/dates'
import { DIFFICULTY_LABELS, RECIPE_CATEGORY_LABELS } from '@shared/recipes'
import { formatScaled } from '@shared/scaling'
import { markdownFilename, recipeToMarkdown } from '@shared/markdown'
import { ApiError, downloadFile } from '@/api/http'
import { useMe } from '@/api/me'
import { useDeleteRecipe, useRecipe } from '@/api/recipes'
import { canShare, copyText, shareText } from '@/composables/useShare'
import { useToday } from '@/composables/useToday'
import EntryDialog from '@/features/meal-plan/components/EntryDialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import { printPage } from '@/composables/usePrintMode'
import { formatMinutes, plural } from '@/lib/format'
import FavoriteButton from '../components/FavoriteButton.vue'

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

const ingredientSuffix = (item: RecipeIngredientDto) =>
  (item.note ? `, ${item.note}` : '') + (item.isOptional ? ' (voliteľné)' : '')

watch(
  recipe,
  (r) => {
    if (r) document.title = `${r.title} · Kuchárska kniha`
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
  const list: Chip[] = [{ text: RECIPE_CATEGORY_LABELS[r.category], color: 'primary' }]
  if (r.prepMinutes !== null)
    list.push({ icon: mdiClockOutline, text: `Príprava ${formatMinutes(r.prepMinutes)}` })
  if (r.cookMinutes !== null)
    list.push({ icon: mdiPotSteamOutline, text: `Varenie ${formatMinutes(r.cookMinutes)}` })
  list.push({ icon: mdiSilverwareForkKnife, text: plural(r.servings, 'porcia', 'porcie', 'porcií') })
  list.push({ icon: mdiChefHat, text: DIFFICULTY_LABELS[r.difficulty as 1 | 2 | 3] })
  return list
})

const { data: me } = useMe()
const today = useToday()
const planOpen = ref(false)
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
    const fromUrl = Number(route.query.porcie)
    return Number.isFinite(fromUrl) && fromUrl >= 1 && fromUrl <= 50 ? fromUrl : (recipe.value?.servings ?? 4)
  },
  set: (value: number | null | undefined) => {
    const query = { ...route.query }
    if (value && value !== recipe.value?.servings) query.porcie = String(value)
    else delete query.porcie
    void router.replace({ query })
  },
})
const factor = computed(() => (recipe.value ? servings.value / recipe.value.servings : 1))
const cookingLink = computed(() => ({
  path: `/recepty/${id.value}/varenie`,
  query: route.query.porcie ? { porcie: String(route.query.porcie) } : {},
}))

// Tlač, kopírovanie, zdieľanie a export: s aktuálne zvoleným počtom porcií
const snackbar = ref({ show: false, text: '', color: 'success' })
const notify = (text: string, color = 'success') => (snackbar.value = { show: true, text, color })
const markdown = computed(() =>
  recipe.value ? recipeToMarkdown(recipe.value, { servings: servings.value }) : '',
)
const supportsShare = canShare()

const printRecipe = () => printPage()

async function copyRecipe() {
  const copied = await copyText(markdown.value)
  notify(copied ? 'Recept je skopírovaný.' : 'Kopírovanie sa nepodarilo.', copied ? 'success' : 'error')
}

async function shareRecipe() {
  if (!recipe.value) return
  try {
    await shareText({ title: recipe.value.title, text: markdown.value })
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Zdieľanie sa nepodarilo.', 'error')
  }
}

async function downloadMarkdown() {
  if (!recipe.value) return
  const query = servings.value !== recipe.value.servings ? `?porcie=${servings.value}` : ''
  try {
    await downloadFile(`/recipes/${id.value}/export.md${query}`, markdownFilename(recipe.value.title))
  } catch (e) {
    notify(e instanceof ApiError ? e.message : 'Stiahnutie sa nepodarilo.', 'error')
  }
}

const confirmDelete = ref(false)
const deleteError = ref('')

async function onDelete() {
  deleteError.value = ''
  try {
    await remove.mutateAsync(id.value)
    confirmDelete.value = false
    await router.replace('/recepty')
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Recept sa nepodarilo zmazať.'
  }
}

function goBack() {
  if (window.history.state?.back) router.back()
  else void router.push('/recepty')
}
</script>

<template>
  <v-toolbar color="transparent" density="compact" class="mb-2 px-0 d-print-none">
    <v-btn :icon="mdiArrowLeft" variant="text" aria-label="Späť" @click="goBack" />
    <v-spacer />
    <template v-if="recipe">
      <FavoriteButton :recipe-id="recipe.id" :is-favorite="recipe.isFavorite" size="default" />
      <v-btn
        :icon="mdiPencilOutline"
        variant="text"
        :to="`/recepty/${recipe.id}/upravit`"
        aria-label="Upraviť"
      />
      <v-btn :icon="mdiCalendarPlus" variant="text" aria-label="Naplánovať" @click="planOpen = true" />
      <v-menu>
        <template #activator="{ props }">
          <v-btn v-bind="props" :icon="mdiDotsVertical" variant="text" aria-label="Ďalšie akcie" />
        </template>
        <v-list>
          <v-list-item
            :prepend-icon="mdiPrinterOutline"
            title="Tlačiť"
            data-test="print"
            @click="printRecipe"
          />
          <v-list-item
            :prepend-icon="mdiContentCopy"
            title="Kopírovať ako text"
            data-test="copy"
            @click="copyRecipe"
          />
          <v-list-item
            v-if="supportsShare"
            :prepend-icon="mdiShareVariantOutline"
            title="Zdieľať"
            data-test="share"
            @click="shareRecipe"
          />
          <v-list-item
            :prepend-icon="mdiFileDownloadOutline"
            title="Stiahnuť ako Markdown"
            data-test="download-md"
            @click="downloadMarkdown"
          />
          <v-divider />
          <v-list-item :prepend-icon="mdiDeleteOutline" title="Zmazať recept" @click="confirmDelete = true" />
        </v-list>
      </v-menu>
    </template>
  </v-toolbar>

  <v-skeleton-loader v-if="isPending" type="image, heading, paragraph, paragraph" />

  <EmptyState
    v-else-if="notFound"
    :icon="mdiPotSteamOutline"
    title="Recept neexistuje"
    text="Možno bol zmazaný."
  >
    <v-btn color="primary" to="/recepty">Späť na recepty</v-btn>
  </EmptyState>

  <v-alert v-else-if="error" type="error" :text="error.message" />

  <template v-else-if="recipe">
    <v-img
      v-if="recipe.coverImageUrl"
      :src="recipe.coverImageUrl"
      :aspect-ratio="16 / 9"
      max-height="420"
      cover
      rounded="md"
      class="mb-4"
    />

    <h1 class="text-h4 font-weight-bold mb-3">{{ recipe.title }}</h1>
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
    <v-btn
      color="primary"
      variant="tonal"
      :prepend-icon="mdiPlayCircleOutline"
      :to="cookingLink"
      class="mb-3 d-print-none"
    >
      Režim varenia
    </v-btn>
    <p v-if="recipe.description" class="text-body-1 mb-3 text-pre-line">
      {{ recipe.description }}
    </p>
    <div v-if="recipe.tags.length" class="d-flex flex-wrap ga-1 mb-4">
      <v-chip
        v-for="tag in recipe.tags"
        :key="tag.id"
        size="small"
        variant="tonal"
        :color="tag.color ?? 'secondary'"
        :to="{ path: '/recepty', query: { tag: tag.id } }"
      >
        #{{ tag.name }}
      </v-chip>
    </div>

    <v-row>
      <v-col cols="12" md="5" lg="4">
        <v-card title="Ingrediencie">
          <v-card-text class="d-none d-print-block pb-0">
            Pre {{ plural(servings, 'porciu', 'porcie', 'porcií') }}
          </v-card-text>
          <v-card-text class="d-flex align-center ga-3 pb-0 d-print-none">
            <v-number-input
              v-model="servings"
              label="Porcie"
              :min="1"
              :max="50"
              control-variant="split"
              density="compact"
              hide-details
              style="max-width: 11rem"
            />
            <v-chip v-if="factor !== 1" size="small" variant="tonal" color="warning">
              pôvodne {{ recipe.servings }}
            </v-chip>
          </v-card-text>
          <v-card-text v-if="!recipe.ingredients.length" class="text-medium-emphasis"
            >Bez ingrediencií.</v-card-text
          >
          <v-list density="compact" class="py-0 pb-2">
            <template v-for="group in groups" :key="group.name">
              <v-list-subheader v-if="group.name" class="text-primary font-weight-bold">
                {{ group.name }}
              </v-list-subheader>
              <v-list-item v-for="item in group.items" :key="item.id">
                <template #prepend>
                  <span class="font-weight-bold text-no-wrap me-3" style="min-width: 4.5rem">
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
                    title="Máš doma"
                  />
                </v-list-item-title>
              </v-list-item>
            </template>
          </v-list>
        </v-card>
      </v-col>

      <v-col cols="12" md="7" lg="8">
        <v-card title="Postup">
          <v-card-text v-if="!recipe.steps.length" class="text-medium-emphasis"
            >Postup zatiaľ nie je zapísaný.</v-card-text
          >
          <v-list v-else lines="three" class="py-0 pb-2">
            <v-list-item v-for="step in recipe.steps" :key="step.id" class="py-3">
              <template #prepend>
                <v-avatar color="primary" size="32" class="font-weight-bold me-3">{{
                  step.position
                }}</v-avatar>
              </template>
              <v-list-item-title class="text-wrap text-body-1 text-pre-line">
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

        <div v-if="recipe.sourceUrl || recipe.sourceText" class="text-body-2 text-medium-emphasis mt-4">
          Zdroj:
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

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">{{ snackbar.text }}</v-snackbar>

  <v-dialog v-model="confirmDelete" max-width="420">
    <v-card title="Zmazať recept?">
      <v-card-text>
        Recept „{{ recipe?.title }}“ zmizne zo zoznamu. Jedálničky, ktoré ho používajú, ostanú.
        <v-alert v-if="deleteError" type="error" class="mt-3" :text="deleteError" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirmDelete = false">Zrušiť</v-btn>
        <v-btn color="error" :loading="remove.isPending.value" @click="onDelete">Zmazať</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
