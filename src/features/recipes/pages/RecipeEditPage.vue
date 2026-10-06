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
import { createDraftStore } from '@/composables/useDraft'
import { useLeavePrompt } from '@/composables/useLeavePrompt'
import { useFlushOnHide } from '@/composables/useFlushOnHide'
import ImagePicker from '../components/ImagePicker.vue'
import IngredientRows from '../components/IngredientRows.vue'
import StepRows from '../components/StepRows.vue'
import {
  describeIssues,
  emptyRecipeForm,
  formToInput,
  importToForm,
  recipeToForm,
  type RecipeForm,
} from '../form'
import { importHandoff } from '../importHandoff'

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

// Import z webu: predvyplní formulár; snapshot ostáva prázdny, takže ide o neuložené zmeny.
const importWarnings = ref<string[]>([])
const imported = ref(false)
if (isNew.value && route.query.import === '1') {
  const result = importHandoff.take()
  if (result) {
    form.value = importToForm(result)
    importWarnings.value = result.warnings
    imported.value = true
  }
}

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

// Koncept v úložisku prehliadača: prežije obnovenie aj zatvorenie stránky, preto nepotrebujeme okno prehliadača
// „Naozaj odísť?“ (to sa nedá upraviť). Pri zatváraní a skrytí stránky sa uloží hneď, bez čakania na pauzu v písaní.
const draft = createDraftStore<RecipeForm>(`recipe:${id.value ?? 'new'}`)
useFlushOnHide(() => draft.flush())
const pendingDraft = ref<RecipeForm | null>(null)
watch(
  loaded,
  (isLoaded) => {
    if (!isLoaded || imported.value) return
    const stored = draft.load()
    if (stored && JSON.stringify(formToInput(stored)) !== snapshot.value) pendingDraft.value = stored
  },
  { immediate: true },
)
watch(
  form,
  (value) => {
    if (loaded.value && dirty.value && !saved.value && !pendingDraft.value) draft.save(value)
  },
  { deep: true },
)

function restoreDraft() {
  if (pendingDraft.value) form.value = pendingDraft.value
  pendingDraft.value = null
}

function discardDraft() {
  pendingDraft.value = null
  draft.clear()
}

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
    draft.clear()
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

// Vlastné okno namiesto okna prehliadača (to ukazuje názov domény a nedá sa upraviť).
const leavePrompt = useLeavePrompt()
onBeforeRouteLeave(async () => {
  if (saved.value || !dirty.value) return true
  const leave = await leavePrompt.ask()
  if (leave) draft.clear()
  return leave
})

function cancel() {
  void router.push(id.value ? `/recepty/${id.value}` : '/recepty')
}
</script>

<template>
  <div>
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

      <v-alert v-if="imported" type="info" title="Recept je načítaný z webu">
        Skontroluj názov, množstvá a postup. Recept sa uloží, až keď klikneš na Uložiť.
        <ul v-if="importWarnings.length" class="mt-1 ps-5">
          <li v-for="warning in importWarnings" :key="warning">{{ warning }}</li>
        </ul>
      </v-alert>

      <v-alert v-if="pendingDraft" type="info" title="Našiel sa rozpísaný recept">
        Tento recept je rozpísaný a neuložený. Chceš pokračovať?
        <template #append>
          <v-btn variant="text" @click="discardDraft">Zahodiť</v-btn>
          <v-btn color="primary" @click="restoreDraft">Obnoviť</v-btn>
        </template>
      </v-alert>

      <v-card title="Základ">
        <v-card-text>
          <div class="d-flex ga-3 mb-3">
            <ImagePicker v-model:image-id="form.coverImageId" v-model:image-url="form.coverImageUrl" />
            <v-text-field
              v-model="form.title"
              autocomplete="off"
              label="Názov receptu"
              :rules="[required]"
              autofocus
              class="flex-grow-1"
            />
          </div>
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
                autocomplete="off"
                label="Príprava (min)"
                inputmode="numeric"
                :rules="[minutesRule]"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="form.cookMinutes"
                autocomplete="off"
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
            selected-class="bg-primary"
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
          <v-text-field
            v-model="form.sourceUrl"
            autocomplete="off"
            label="Odkaz na pôvodný recept"
            type="url"
            hide-details
          />
          <v-text-field
            v-model="form.sourceText"
            autocomplete="off"
            label="Zdroj (napr. babka, kniha)"
            hide-details
          />
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

  <v-dialog v-model="leavePrompt.open.value" max-width="420" persistent>
    <v-card title="Neuložené zmeny">
      <v-card-text>Recept máš rozpísaný a neuložený. Ak odídeš, zmeny sa stratia.</v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn color="error" variant="text" data-test="leave-discard" @click="leavePrompt.answer(true)">
          Zahodiť zmeny
        </v-btn>
        <v-btn color="primary" data-test="leave-stay" @click="leavePrompt.answer(false)">Zostať</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
