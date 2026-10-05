<script setup lang="ts">
import { mdiArrowLeft, mdiContentSaveOutline } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type { VForm } from 'vuetify/components'
import { DIFFICULTY_LABELS, RECIPE_CATEGORIES, RECIPE_CATEGORY_LABELS } from '@shared/recipes'
import { recipeInputSchema } from '@shared/schemas/recipe'
import { useTags } from '@/api/catalog'
import { ApiError } from '@/api/http'
import { useRecipe, useSaveRecipe } from '@/api/recipes'
import { describeIssues, emptyRecipeForm, formToInput, recipeToForm, type RecipeForm } from '../form'
import IngredientRows from '../components/IngredientRows.vue'
import ImagePicker from '../components/ImagePicker.vue'
import StepRows from '../components/StepRows.vue'

const route = useRoute()
const router = useRouter()
const id = computed(() => (typeof route.params.id === 'string' ? route.params.id : undefined))
const isNew = computed(() => !id.value)

const { data: existing, isPending: loading, error: loadError } = useRecipe(id)
const { data: tags } = useTags()
const save = useSaveRecipe()

const form = ref<RecipeForm>(emptyRecipeForm())
const snapshot = ref(JSON.stringify(formToInput(form.value)))
const loaded = ref(isNew.value)

watch(
  existing,
  (detail) => {
    if (!detail || loaded.value) return
    form.value = recipeToForm(detail)
    snapshot.value = JSON.stringify(formToInput(form.value))
    loaded.value = true
  },
  { immediate: true },
)

const dirty = computed(() => JSON.stringify(formToInput(form.value)) !== snapshot.value)

const categoryItems = RECIPE_CATEGORIES.map((value) => ({ value, title: RECIPE_CATEGORY_LABELS[value] }))
const tagNames = computed(() => tags.value?.map((t) => t.name) ?? [])

const formRef = ref<VForm>()
const errors = ref<string[]>([])
let saved = false

const required = (v: string) => Boolean(v?.trim()) || 'Povinné pole'
const minutesRule = (v: string) => !v?.trim() || /^\d+$/.test(v.trim()) || 'Celé číslo minút'

async function onSubmit() {
  errors.value = []
  const { valid } = (await formRef.value?.validate()) ?? { valid: true }
  const parsed = recipeInputSchema.safeParse(formToInput(form.value))
  if (!valid || !parsed.success) {
    errors.value = parsed.success ? ['Skontroluj zvýraznené polia.'] : describeIssues(parsed.error.issues)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  try {
    const detail = await save.mutateAsync({ id: id.value, input: formToInput(form.value) })
    saved = true
    await router.replace(`/recepty/${detail.id}`)
  } catch (e) {
    if (e instanceof ApiError && Array.isArray(e.details)) {
      errors.value = describeIssues(e.details as { path: PropertyKey[]; message: string }[])
    } else {
      errors.value = [e instanceof Error ? e.message : 'Recept sa nepodarilo uložiť.']
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

onBeforeRouteLeave(() => {
  if (saved || !dirty.value) return true
  return window.confirm('Máš neuložené zmeny. Naozaj odísť?')
})

function cancel() {
  void router.push(id.value ? `/recepty/${id.value}` : '/recepty')
}
</script>

<template>
  <div class="tw:mx-auto tw:flex tw:w-full tw:max-w-3xl tw:flex-col tw:gap-4 tw:pb-24">
    <div class="tw:flex tw:items-center tw:gap-2">
      <v-btn :icon="mdiArrowLeft" variant="text" aria-label="Späť" @click="cancel" />
      <h1 class="text-h5">{{ isNew ? 'Nový recept' : 'Upraviť recept' }}</h1>
    </div>

    <v-skeleton-loader v-if="!isNew && loading" type="image, article, article" />
    <v-alert v-else-if="loadError" type="error" variant="tonal" :text="loadError.message" />

    <v-form v-else ref="formRef" class="tw:flex tw:flex-col tw:gap-4" @submit.prevent="onSubmit">
      <v-alert v-if="errors.length" type="error" variant="tonal" title="Recept sa nedá uložiť">
        <ul class="tw:mt-1 tw:list-disc tw:pl-5">
          <li v-for="message in errors" :key="message">{{ message }}</li>
        </ul>
      </v-alert>

      <ImagePicker v-model:image-id="form.coverImageId" v-model:image-url="form.coverImageUrl" />

      <v-card title="Základ">
        <v-card-text class="tw:flex tw:flex-col tw:gap-3">
          <v-text-field v-model="form.title" label="Názov receptu" :rules="[required]" autofocus />
          <div class="tw:grid tw:grid-cols-2 tw:gap-3">
            <v-select v-model="form.category" :items="categoryItems" label="Kategória" hide-details />
            <v-number-input
              v-model="form.servings"
              label="Porcie"
              :min="1"
              :max="50"
              control-variant="split"
              hide-details
            />
            <v-text-field
              v-model="form.prepMinutes"
              label="Príprava (min)"
              inputmode="numeric"
              :rules="[minutesRule]"
              hide-details="auto"
            />
            <v-text-field
              v-model="form.cookMinutes"
              label="Varenie (min)"
              inputmode="numeric"
              :rules="[minutesRule]"
              hide-details="auto"
            />
          </div>
          <div>
            <div class="text-caption text-medium-emphasis tw:mb-1">Náročnosť</div>
            <v-btn-toggle v-model="form.difficulty" mandatory color="primary" variant="outlined" divided>
              <v-btn v-for="level in [1, 2, 3]" :key="level" :value="level">
                {{ DIFFICULTY_LABELS[level as 1 | 2 | 3] }}
              </v-btn>
            </v-btn-toggle>
          </div>
          <v-textarea v-model="form.description" label="Krátky popis" rows="2" auto-grow hide-details />
        </v-card-text>
      </v-card>

      <v-card title="Ingrediencie">
        <v-card-text>
          <IngredientRows v-model="form.ingredients" />
        </v-card-text>
      </v-card>

      <v-card title="Postup">
        <v-card-text>
          <StepRows v-model="form.steps" />
        </v-card-text>
      </v-card>

      <v-card title="Tagy a zdroj">
        <v-card-text class="tw:flex tw:flex-col tw:gap-3">
          <v-combobox
            v-model="form.tags"
            :items="tagNames"
            label="Tagy (napr. rýchle, detské)"
            multiple
            chips
            closable-chips
            hide-details
          />
          <v-text-field v-model="form.sourceUrl" label="Odkaz na pôvodný recept" type="url" hide-details />
          <v-text-field v-model="form.sourceText" label="Zdroj (napr. babka, kniha)" hide-details />
        </v-card-text>
      </v-card>

      <div class="edit-actions tw:flex tw:gap-2">
        <v-spacer />
        <v-btn variant="text" @click="cancel">Zrušiť</v-btn>
        <v-btn
          type="submit"
          color="primary"
          size="large"
          :prepend-icon="mdiContentSaveOutline"
          :loading="save.isPending.value"
        >
          Uložiť recept
        </v-btn>
      </div>
    </v-form>
  </div>
</template>

<style scoped>
.edit-actions {
  position: sticky;
  bottom: calc(var(--v-layout-bottom, 0px) + 8px);
  z-index: 4;
  padding: 8px;
  border-radius: 16px;
  background: rgb(var(--v-theme-background) / 0.92);
  backdrop-filter: blur(6px);
}
</style>
