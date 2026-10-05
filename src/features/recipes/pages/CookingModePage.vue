<script setup lang="ts">
import { mdiArrowLeft, mdiCheckAll, mdiFoodVariant } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useDisplay } from 'vuetify'
import { formatScaled } from '@shared/scaling'
import { useRecipe } from '@/api/recipes'
import EmptyState from '@/components/EmptyState.vue'
import { useWakeLock } from '@/composables/useWakeLock'
import StepTimer from '../components/StepTimer.vue'

const route = useRoute()
const { mdAndUp } = useDisplay()
const id = computed(() => String(route.params.id))
const { data: recipe, isPending, error } = useRecipe(id)

// Obrazovka ostane zapnutá, kým varíš.
const { supported: wakeLockSupported } = useWakeLock()

const factor = computed(() => {
  const requested = Number(route.query.porcie)
  const r = recipe.value
  return r && Number.isFinite(requested) && requested >= 1 ? requested / r.servings : 1
})
const servingsLabel = computed(() => {
  const r = recipe.value
  return r ? Math.round(r.servings * factor.value * 100) / 100 : 0
})

// Odškrtnuté kroky prežijú obnovenie stránky (pamätá sa len v tejto karte prehliadača).
const storageKey = computed(() => `kniha:cook:${id.value}`)
const checked = ref<Set<string>>(new Set())
watch(
  storageKey,
  (key) => {
    try {
      checked.value = new Set(JSON.parse(sessionStorage.getItem(key) ?? '[]') as string[])
    } catch {
      checked.value = new Set()
    }
  },
  { immediate: true },
)
function toggleStep(stepId: string) {
  const next = new Set(checked.value)
  if (!next.delete(stepId)) next.add(stepId)
  checked.value = next
  try {
    sessionStorage.setItem(storageKey.value, JSON.stringify([...next]))
  } catch {
    // súkromné okno a pod.
  }
}

const steps = computed(() => recipe.value?.steps ?? [])
const currentStepId = computed(() => steps.value.find((s) => !checked.value.has(s.id))?.id ?? null)
const progress = computed(() => (steps.value.length ? (checked.value.size / steps.value.length) * 100 : 0))
const allDone = computed(() => steps.value.length > 0 && currentStepId.value === null)

const ingredientsOpen = ref(false)
const snackbar = ref({ show: false, text: '' })
function onTimerDone(position: number) {
  snackbar.value = { show: true, text: `Časovač kroku ${position} dobehol.` }
}
</script>

<template>
  <v-toolbar color="transparent" density="compact" class="px-0">
    <v-btn :icon="mdiArrowLeft" variant="text" aria-label="Späť na recept" :to="`/recepty/${id}`" />
    <v-toolbar-title class="font-weight-bold">{{ recipe?.title ?? 'Režim varenia' }}</v-toolbar-title>
    <v-btn
      v-if="recipe"
      :prepend-icon="mdiFoodVariant"
      variant="tonal"
      color="primary"
      @click="ingredientsOpen = true"
    >
      Ingrediencie
    </v-btn>
  </v-toolbar>

  <v-progress-linear :model-value="progress" color="primary" height="6" rounded class="mb-4" />

  <v-skeleton-loader v-if="isPending" type="article, article" />
  <v-alert v-else-if="error" type="error" :text="error.message" />

  <template v-else-if="recipe">
    <p v-if="!wakeLockSupported" class="text-caption text-medium-emphasis mb-2">
      Tento prehliadač nevie držať obrazovku zapnutú, nastav jej dlhšie vypnutie v zariadení.
    </p>
    <p class="text-body-2 text-medium-emphasis mb-3">
      Varíš pre {{ servingsLabel }} porcií. Ťukni na krok, keď je hotový.
    </p>

    <EmptyState
      v-if="!steps.length"
      :icon="mdiFoodVariant"
      title="Recept nemá postup"
      text="Doplň kroky v úprave receptu."
    >
      <v-btn color="primary" :to="`/recepty/${id}/upravit`">Upraviť recept</v-btn>
    </EmptyState>

    <div class="d-flex flex-column ga-3">
      <v-card
        v-for="step in steps"
        :key="step.id"
        :variant="step.id === currentStepId ? 'tonal' : 'outlined'"
        :color="step.id === currentStepId ? 'primary' : undefined"
        :class="{ 'opacity-60': checked.has(step.id) }"
      >
        <v-card-text class="d-flex ga-3 align-start">
          <v-checkbox-btn
            :model-value="checked.has(step.id)"
            color="primary"
            :aria-label="`Krok ${step.position} hotový`"
            @update:model-value="toggleStep(step.id)"
          />
          <div class="flex-grow-1" @click="toggleStep(step.id)">
            <div class="text-overline">Krok {{ step.position }}</div>
            <div
              class="text-h6 font-weight-regular text-pre-line"
              :class="{ 'text-decoration-line-through': checked.has(step.id) }"
            >
              {{ step.text }}
            </div>
          </div>
        </v-card-text>
        <v-card-actions v-if="step.timerSeconds" class="px-4 pb-4 pt-0">
          <StepTimer :seconds="step.timerSeconds" @done="onTimerDone(step.position)" />
        </v-card-actions>
      </v-card>
    </div>

    <v-alert v-if="allDone" type="success" :icon="mdiCheckAll" title="Dobrú chuť!" class="mt-4">
      Všetky kroky sú hotové.
      <template #append>
        <v-btn color="success" variant="flat" :to="`/recepty/${id}`">Hotovo</v-btn>
      </template>
    </v-alert>

    <v-navigation-drawer v-if="mdAndUp" v-model="ingredientsOpen" location="end" temporary width="340">
      <v-list-subheader class="font-weight-bold"
        >Ingrediencie pre {{ servingsLabel }} porcií</v-list-subheader
      >
      <v-list density="compact">
        <v-list-item v-for="item in recipe.ingredients" :key="item.id" :title="item.name">
          <template #append>
            <span class="font-weight-bold">{{ formatScaled(item.quantity, factor, item.unit) }}</span>
          </template>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-bottom-sheet v-else v-model="ingredientsOpen">
      <v-card :title="`Ingrediencie pre ${servingsLabel} porcií`">
        <v-list density="compact">
          <v-list-item v-for="item in recipe.ingredients" :key="item.id" :title="item.name">
            <template #append>
              <span class="font-weight-bold">{{ formatScaled(item.quantity, factor, item.unit) }}</span>
            </template>
          </v-list-item>
        </v-list>
      </v-card>
    </v-bottom-sheet>
  </template>

  <v-snackbar v-model="snackbar.show" color="success" timeout="6000">{{ snackbar.text }}</v-snackbar>
</template>
