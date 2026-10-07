<script setup lang="ts">
import { mdiArrowLeft, mdiContentSaveOutline } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type { VForm } from 'vuetify/components'
import { RECIPE_CATEGORIES, type RecipeCategory } from '@shared/recipes'
import { useKidsEnabled } from '@/composables/useKidsEnabled'
import { recipeInputSchema } from '@shared/schemas/recipe'
import { useTags } from '@/api/catalog'
import { ApiError } from '@/api/http'
import { useRecipe, useSaveRecipe } from '@/api/recipes'
import { createDraftStore } from '@/composables/useDraft'
import { useLeavePrompt } from '@/composables/useLeavePrompt'
import { useFlushOnHide } from '@/composables/useFlushOnHide'
import { errorText } from '@/i18n/errors'
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

const { t } = useI18n()
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

const kidsEnabled = useKidsEnabled()
// Pri vypnutých detských jedlách sa kategória Detské neponúka (okrem receptu, ktorý ju už má).
const categoryItems = computed(() =>
  RECIPE_CATEGORIES.filter(
    (value) => kidsEnabled.value || value !== 'detske' || form.value.category === 'detske',
  ).map((value) => ({ value, title: t(`common.category.${value}`) })),
)
// Zaškrtávacie pole „Detský recept“ je skratka pre typ jedla Detské: zaškrtnutím sa typ nastaví a odškrtnutím sa vráti
// predošlý (alebo Hlavné jedlo, ak recept bol detský už pri otvorení).
const showKidsFlag = computed(() => kidsEnabled.value || form.value.category === 'detske')
const categoryBeforeKids = ref<RecipeCategory>('hlavne')
const kidsFlag = computed({
  get: () => form.value.category === 'detske',
  set: (checked: boolean) => {
    if (checked) {
      if (form.value.category !== 'detske') categoryBeforeKids.value = form.value.category
      form.value.category = 'detske'
    } else form.value.category = categoryBeforeKids.value === 'detske' ? 'hlavne' : categoryBeforeKids.value
  },
})
const tagNames = computed(() => tags.value?.map((tag) => tag.name) ?? [])

const formRef = ref<VForm>()
const errors = ref<string[]>([])

const required = (v: string) => Boolean(v?.trim()) || t('recipes.editor.required')
const minutesRule = (v: string) => !v?.trim() || /^\d+$/.test(v.trim()) || t('recipes.editor.wholeMinutes')

async function onSubmit() {
  errors.value = []
  const { valid } = (await formRef.value?.validate()) ?? { valid: true }
  const parsed = recipeInputSchema.safeParse(formToInput(form.value))
  if (!valid || !parsed.success) {
    errors.value = parsed.success ? [t('recipes.editor.checkFields')] : describeIssues(parsed.error.issues)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  try {
    const detail = await save.mutateAsync({ id: id.value, input: formToInput(form.value) })
    saved.value = true
    draft.clear()
    await router.replace(`/recipes/${detail.id}`)
  } catch (e) {
    if (e instanceof ApiError && Array.isArray(e.details)) {
      errors.value = describeIssues(e.details as { path: PropertyKey[]; message: string }[])
    } else {
      errors.value = [errorText(e, 'recipes.editor.saveFailed')]
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
  void router.push(id.value ? `/recipes/${id.value}` : '/recipes')
}
</script>

<template>
  <div>
    <v-toolbar color="transparent" density="compact" class="mb-2 px-0">
      <v-btn :icon="mdiArrowLeft" variant="text" :aria-label="t('common.actions.back')" @click="cancel" />
      <v-toolbar-title class="text-h5 font-weight-bold">{{
        isNew ? t('recipes.editor.newTitle') : t('recipes.editor.editTitle')
      }}</v-toolbar-title>
    </v-toolbar>

    <v-skeleton-loader v-if="!isNew && loading" type="image, article, article" />
    <v-alert v-else-if="loadError" type="error" :text="errorText(loadError)" />

    <v-form v-else ref="formRef" class="d-flex flex-column ga-4" @submit.prevent="onSubmit">
      <v-alert v-if="errors.length" type="error" :title="t('recipes.editor.errorsTitle')">
        <ul class="mt-1 ps-5">
          <li v-for="message in errors" :key="message">{{ message }}</li>
        </ul>
      </v-alert>

      <v-alert v-if="imported" type="info" :title="t('recipes.editor.importedTitle')">
        {{ t('recipes.editor.importedText') }}
        <ul v-if="importWarnings.length" class="mt-1 ps-5">
          <li v-for="warning in importWarnings" :key="warning">{{ warning }}</li>
        </ul>
      </v-alert>

      <v-alert v-if="pendingDraft" type="info" :title="t('recipes.editor.draftTitle')">
        {{ t('recipes.editor.draftText') }}
        <template #append>
          <v-btn variant="text" @click="discardDraft">{{ t('recipes.editor.discard') }}</v-btn>
          <v-btn color="primary" @click="restoreDraft">{{ t('recipes.editor.restore') }}</v-btn>
        </template>
      </v-alert>

      <v-card :title="t('recipes.editor.basics')">
        <v-card-text>
          <div class="d-flex ga-3 mb-3">
            <ImagePicker v-model:image-id="form.coverImageId" v-model:image-url="form.coverImageUrl" />
            <v-text-field
              v-model="form.title"
              autocomplete="off"
              :label="t('recipes.editor.titleLabel')"
              :rules="[required]"
              autofocus
              class="flex-grow-1"
            />
          </div>
          <v-checkbox
            v-if="showKidsFlag"
            v-model="kidsFlag"
            :label="t('recipes.editor.kidsFlag')"
            hide-details
            data-test="kids-flag"
          />
          <v-row density="compact">
            <v-col cols="12" sm="6">
              <v-select
                v-model="form.category"
                :items="categoryItems"
                :label="t('recipes.editor.category')"
                hide-details
                data-test="recipe-category"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-number-input
                v-model="form.servings"
                :label="t('recipes.editor.servings')"
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
                :label="t('recipes.editor.prep')"
                inputmode="numeric"
                :rules="[minutesRule]"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="form.cookMinutes"
                autocomplete="off"
                :label="t('recipes.editor.cook')"
                inputmode="numeric"
                :rules="[minutesRule]"
                hide-details="auto"
              />
            </v-col>
          </v-row>
          <div class="text-caption text-medium-emphasis mt-3 mb-1">{{ t('recipes.editor.difficulty') }}</div>
          <v-btn-toggle
            v-model="form.difficulty"
            mandatory
            selected-class="bg-primary"
            variant="outlined"
            divided
            :aria-label="t('recipes.editor.difficulty')"
          >
            <v-btn v-for="level in [1, 2, 3]" :key="level" :value="level">
              {{ t(`common.difficulty.${level}`) }}
            </v-btn>
          </v-btn-toggle>
          <v-textarea
            v-model="form.description"
            :label="t('recipes.editor.description')"
            rows="2"
            auto-grow
            hide-details
            class="mt-4"
          />
        </v-card-text>
      </v-card>

      <v-card :title="t('recipes.editor.ingredients')">
        <v-card-text><IngredientRows v-model="form.ingredients" /></v-card-text>
      </v-card>

      <v-card :title="t('recipes.editor.steps')">
        <v-card-text><StepRows v-model="form.steps" /></v-card-text>
      </v-card>

      <v-card :title="t('recipes.editor.tagsAndSource')">
        <v-card-text class="d-flex flex-column ga-3">
          <v-combobox
            v-model="form.tags"
            :items="tagNames"
            :label="t('recipes.editor.tags')"
            multiple
            chips
            closable-chips
            hide-details
          />
          <v-text-field
            v-model="form.sourceUrl"
            autocomplete="off"
            :label="t('recipes.editor.sourceUrl')"
            type="url"
            hide-details
          />
          <v-text-field
            v-model="form.sourceText"
            autocomplete="off"
            :label="t('recipes.editor.sourceText')"
            hide-details
          />
        </v-card-text>
      </v-card>

      <v-sheet color="background" class="position-sticky bottom-0 py-2 d-flex ga-2 justify-end">
        <v-btn variant="text" @click="cancel">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn
          type="submit"
          color="primary"
          size="large"
          :prepend-icon="mdiContentSaveOutline"
          :loading="save.isPending.value"
        >
          {{ t('recipes.editor.saveRecipe') }}
        </v-btn>
      </v-sheet>
    </v-form>
  </div>

  <v-dialog v-model="leavePrompt.open.value" max-width="420" persistent>
    <v-card :title="t('recipes.editor.leaveTitle')">
      <v-card-text>{{ t('recipes.editor.leaveText') }}</v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn color="error" variant="text" data-test="leave-discard" @click="leavePrompt.answer(true)">
          {{ t('recipes.editor.leaveDiscard') }}
        </v-btn>
        <v-btn color="primary" data-test="leave-stay" @click="leavePrompt.answer(false)">{{
          t('recipes.editor.leaveStay')
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
