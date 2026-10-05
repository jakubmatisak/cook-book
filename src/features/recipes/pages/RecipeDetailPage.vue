<script setup lang="ts">
import {
  mdiArrowLeft,
  mdiChefHat,
  mdiClockOutline,
  mdiDeleteOutline,
  mdiDotsVertical,
  mdiLinkVariant,
  mdiPencilOutline,
  mdiPotSteamOutline,
  mdiSilverwareForkKnife,
  mdiTimerOutline,
} from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { RecipeIngredientDto } from '@shared/api'
import { DIFFICULTY_LABELS, RECIPE_CATEGORY_LABELS } from '@shared/recipes'
import { formatQuantity } from '@shared/units'
import { ApiError } from '@/api/http'
import { useDeleteRecipe, useRecipe } from '@/api/recipes'
import EmptyState from '@/components/EmptyState.vue'
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

watch(recipe, (r) => {
  if (r) document.title = `${r.title} · Kuchárska kniha`
})

const difficultyLabel = computed(() =>
  recipe.value ? DIFFICULTY_LABELS[recipe.value.difficulty as 1 | 2 | 3] : '',
)

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
  <div class="tw:flex tw:flex-col tw:gap-4">
    <div class="tw:flex tw:items-center tw:gap-1">
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
        <v-menu>
          <template #activator="{ props }">
            <v-btn v-bind="props" :icon="mdiDotsVertical" variant="text" aria-label="Ďalšie akcie" />
          </template>
          <v-list>
            <v-list-item
              :prepend-icon="mdiDeleteOutline"
              title="Zmazať recept"
              @click="confirmDelete = true"
            />
          </v-list>
        </v-menu>
      </template>
    </div>

    <v-skeleton-loader v-if="isPending" type="image, heading, paragraph, paragraph" />

    <EmptyState
      v-else-if="notFound"
      :icon="mdiPotSteamOutline"
      title="Recept neexistuje"
      text="Možno bol zmazaný."
    >
      <v-btn color="primary" to="/recepty">Späť na recepty</v-btn>
    </EmptyState>

    <v-alert v-else-if="error" type="error" variant="tonal" :text="error.message" />

    <template v-else-if="recipe">
      <v-img
        v-if="recipe.coverImageUrl"
        :src="recipe.coverImageUrl"
        :aspect-ratio="16 / 9"
        max-height="420"
        cover
        class="tw:rounded-2xl"
      />

      <div>
        <h1 class="text-h4 tw:font-bold tw:leading-tight">{{ recipe.title }}</h1>
        <div class="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
          <v-chip size="small" color="primary" variant="tonal">{{
            RECIPE_CATEGORY_LABELS[recipe.category]
          }}</v-chip>
          <v-chip v-if="recipe.prepMinutes !== null" size="small" :prepend-icon="mdiClockOutline">
            Príprava {{ formatMinutes(recipe.prepMinutes) }}
          </v-chip>
          <v-chip v-if="recipe.cookMinutes !== null" size="small" :prepend-icon="mdiPotSteamOutline">
            Varenie {{ formatMinutes(recipe.cookMinutes) }}
          </v-chip>
          <v-chip size="small" :prepend-icon="mdiSilverwareForkKnife">{{
            plural(recipe.servings, 'porcia', 'porcie', 'porcií')
          }}</v-chip>
          <v-chip size="small" :prepend-icon="mdiChefHat">{{ difficultyLabel }}</v-chip>
        </div>
        <p v-if="recipe.description" class="text-body-1 tw:mt-4 tw:whitespace-pre-line">
          {{ recipe.description }}
        </p>
        <div v-if="recipe.tags.length" class="tw:mt-3 tw:flex tw:flex-wrap tw:gap-1">
          <v-chip
            v-for="tag in recipe.tags"
            :key="tag.id"
            size="small"
            variant="tonal"
            color="secondary"
            :to="{ path: '/recepty', query: { tag: tag.id } }"
          >
            #{{ tag.name }}
          </v-chip>
        </div>
      </div>

      <div class="tw:grid tw:gap-4 tw:md:grid-cols-[minmax(260px,1fr)_2fr]">
        <v-card title="Ingrediencie" class="tw:self-start tw:md:sticky tw:md:top-20">
          <v-card-text>
            <p v-if="!recipe.ingredients.length" class="text-medium-emphasis">Bez ingrediencií.</p>
            <div v-for="group in groups" :key="group.name" class="tw:mb-3 tw:last:mb-0">
              <div v-if="group.name" class="text-overline text-primary">{{ group.name }}</div>
              <ul class="tw:flex tw:flex-col tw:gap-2">
                <li v-for="item in group.items" :key="item.id" class="tw:flex tw:gap-2">
                  <span class="tw:min-w-[4.5rem] tw:font-bold">{{
                    formatQuantity(item.quantity, item.unit)
                  }}</span>
                  <!-- prettier-ignore -->
                  <span>{{ item.name }}<span class="text-medium-emphasis">{{ ingredientSuffix(item) }}</span></span>
                </li>
              </ul>
            </div>
          </v-card-text>
        </v-card>

        <v-card title="Postup">
          <v-card-text>
            <p v-if="!recipe.steps.length" class="text-medium-emphasis">Postup zatiaľ nie je zapísaný.</p>
            <ol class="tw:flex tw:flex-col tw:gap-4">
              <li v-for="step in recipe.steps" :key="step.id" class="tw:flex tw:gap-3">
                <v-avatar size="28" color="primary" class="tw:shrink-0 tw:text-sm tw:font-bold">
                  {{ step.position }}
                </v-avatar>
                <div class="tw:flex-1">
                  <p class="text-body-1 tw:whitespace-pre-line">{{ step.text }}</p>
                  <v-chip
                    v-if="step.timerSeconds"
                    size="x-small"
                    class="tw:mt-1"
                    :prepend-icon="mdiTimerOutline"
                  >
                    {{ formatMinutes(Math.round(step.timerSeconds / 60)) }}
                  </v-chip>
                </div>
              </li>
            </ol>
          </v-card-text>
        </v-card>
      </div>

      <div v-if="recipe.sourceUrl || recipe.sourceText" class="text-body-2 text-medium-emphasis">
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
    </template>

    <v-dialog v-model="confirmDelete" max-width="420">
      <v-card title="Zmazať recept?">
        <v-card-text>
          Recept „{{ recipe?.title }}“ zmizne zo zoznamu. Jedálničky, ktoré ho používajú, ostanú.
          <v-alert v-if="deleteError" type="error" variant="tonal" class="tw:mt-3" :text="deleteError" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmDelete = false">Zrušiť</v-btn>
          <v-btn color="error" variant="flat" :loading="remove.isPending.value" @click="onDelete"
            >Zmazať</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
