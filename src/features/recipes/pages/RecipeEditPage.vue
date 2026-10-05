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
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import ImagePicker from '../components/ImagePicker.vue'
import IngredientRows from '../components/IngredientRows.vue'
import StepRows from '../components/StepRows.vue'
import { describeIssues, emptyRecipeForm, formToInput, recipeToForm, type RecipeForm } from '../form'

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
const saved = ref(false)
useUnsavedChangesGuard(() => dirty.value && !saved.value)

const categoryItems = RECIPE_CATEGORIES.map((value) => ({ value, title: RECIPE_CATEGORY_LABELS[value] }))
const tagNames = computed(() => tags.value?.map((t) => t.name) ?? [])

const formRef = ref<VForm>()
const errors = ref<string[]>([])

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
    saved.value = true
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
  if (saved.value || !dirty.value) return true
  return window.confirm('Máš neuložené zmeny. Naozaj odísť?')
})

function cancel() {
  void router.push(id.value ? `/recepty/${id.value}` : '/recepty')
}
</script>

<template>
  <div class="mx-auto" style="max-width: 48rem">
    <v-toolbar color="transparent" density="compact" class="mb-2 px-0">
      <v-btn :icon="mdiArrowLeft" variant="text" aria-label="Späť" @click="cancel" />
      <v-toolbar-title class="text-h5 font-weight-bold">{{
        isNew ? 'Nový recept' : 'Upraviť recept'
      }}</v-toolbar-title>
    </v-toolbar>

    <v-skeleton-loader v-if="!isNew && loading" type="image, article, article" />
    <v-alert v-else-if="loadError" type="error" :text="loadError.message" />

    <v-form v-else ref="formRef" class="d-flex flex-column ga-4" @submit.prevent="onSubmit">
      <v-alert v-if="errors.length" type="error" title="Recept sa nedá uložiť">
        <ul class="mt-1 ps-5">
          <li v-for="message in errors" :key="message">{{ message }}</li>
        </ul>
      </v-alert>

      <ImagePicker v-model:image-id="form.coverImageId" v-model:image-url="form.coverImageUrl" />

      <v-card title="Základ">
        <v-card-text>
          <v-text-field
            v-model="form.title"
            label="Názov receptu"
            :rules="[required]"
            autofocus
            class="mb-3"
          />
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-select v-model="form.category" :items="categoryItems" label="Kategória" hide-details />
            </v-col>
            <v-col cols="12" sm="6">
              <v-number-input
                v-model="form.servings"
                label="Porcie"
                :min="1"
                :max="50"
                control-variant="split"
                hide-details
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="form.prepMinutes"
                label="Príprava (min)"
                inputmode="numeric"
                :rules="[minutesRule]"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="form.cookMinutes"
                label="Varenie (min)"
                inputmode="numeric"
                :rules="[minutesRule]"
                hide-details="auto"
              />
            </v-col>
          </v-row>
          <div class="text-caption text-medium-emphasis mt-3 mb-1">Náročnosť</div>
          <v-btn-toggle
            v-model="form.difficulty"
            mandatory
            color="primary"
            variant="outlined"
            divided
            aria-label="Náročnosť"
          >
            <v-btn v-for="level in [1, 2, 3]" :key="level" :value="level">
              {{ DIFFICULTY_LABELS[level as 1 | 2 | 3] }}
            </v-btn>
          </v-btn-toggle>
          <v-textarea
            v-model="form.description"
            label="Krátky popis"
            rows="2"
            auto-grow
            hide-details
            class="mt-4"
          />
        </v-card-text>
      </v-card>

      <v-card title="Ingrediencie">
        <v-card-text><IngredientRows v-model="form.ingredients" /></v-card-text>
      </v-card>

      <v-card title="Postup">
        <v-card-text><StepRows v-model="form.steps" /></v-card-text>
      </v-card>

      <v-card title="Tagy a zdroj">
        <v-card-text class="d-flex flex-column ga-3">
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

      <v-sheet color="background" class="position-sticky bottom-0 py-2 d-flex ga-2 justify-end">
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
      </v-sheet>
    </v-form>
  </div>
</template>
