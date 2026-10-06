<script setup lang="ts">
import { slotName } from '@/i18n/defaults'
import {
  mdiBookmarkPlusOutline,
  mdiContentCopy,
  mdiDownload,
  mdiFileDocumentOutline,
  mdiLogout,
  mdiPuzzleOutline,
} from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'
import { useUpdateSettings, useUpdateSlot } from '@/api/family'
import { recipeKeys } from '@/api/recipes'
import { useSaveUserSettings } from '@/api/userSettings'
import { useKidsEnabled } from '@/composables/useKidsEnabled'
import { ApiError, downloadFile } from '@/api/http'
import { useIsOwner, useMe } from '@/api/me'
import PageHeader from '@/components/PageHeader.vue'
import HouseholdMembersCard from '@/features/households/components/HouseholdMembersCard.vue'
import SampleRecipesButton from '@/features/recipes/components/SampleRecipesButton.vue'
import LanguageCard from '../components/LanguageCard.vue'
import { importBookmarklet } from '../bookmarklet'
import { useThemePreference } from '@/composables/useThemePreference'
import { ACCESS_LOGOUT_PATH, canLogout } from '@/lib/auth'
import { errorText } from '@/i18n/errors'
import { formatNumber, tc } from '@/i18n/format'

const { t } = useI18n()
const { data: me, isPending, error } = useMe()
const isOwner = useIsOwner()

const { preference: themePreference, set: setTheme } = useThemePreference()

const snackbar = ref({ show: false, text: '', color: 'error' })
const updateSlot = useUpdateSlot()
const updateSettings = useUpdateSettings()

// Pridávanie receptov z internetu: záložka na pretiahnutie a rozšírenie do Chromu na stiahnutie.
const appAddress = location.origin
const bookmarklet = importBookmarklet(appAddress)
async function copyAddress() {
  try {
    await navigator.clipboard.writeText(appAddress)
    snackbar.value = { show: true, text: t('settings.capture.copied'), color: 'success' }
  } catch {
    snackbar.value = { show: true, text: t('settings.capture.copyFailed'), color: 'error' }
  }
}

const client = useQueryClient()
const kidsEnabled = useKidsEnabled()
const saveUserSettings = useSaveUserSettings()
// Zapnuté je predvolené, preto sa pri zapnutí nastavenie zmaže (null) a vypnutie sa uloží ako false.
function saveKids(value: boolean | null) {
  saveUserSettings.mutate(
    { kidsEnabled: value ? null : false },
    {
      onSuccess: () => client.invalidateQueries({ queryKey: recipeKeys.all }),
      onError: () => (snackbar.value = { show: true, text: t('settings.changeFailed'), color: 'error' }),
    },
  )
}

const WEEK_STARTS = computed<{ value: 0 | 1 | 6; title: string }[]>(() => [
  { value: 1, title: t('settings.plan.weekdays.monday') },
  { value: 0, title: t('settings.plan.weekdays.sunday') },
  { value: 6, title: t('settings.plan.weekdays.saturday') },
])

const childFactor = ref(0.5)
watch(
  () => me.value?.settings.childPortionFactor,
  (value) => {
    if (value !== undefined) childFactor.value = value
  },
  { immediate: true },
)

async function run(action: () => Promise<unknown>) {
  try {
    await action()
  } catch (e) {
    snackbar.value = {
      show: true,
      text: errorText(e, 'settings.changeFailed'),
      color: 'error',
    }
  }
}

const toggleSlot = (id: string, isEnabled: boolean | null) =>
  run(() => updateSlot.mutateAsync({ id, patch: { isEnabled: Boolean(isEnabled) } }))
const setWeekStart = (value: number) =>
  run(() => updateSettings.mutateAsync({ weekStartsOn: value as 0 | 1 | 6 }))
const saveIgnoreSpices = (value: boolean | null) =>
  run(() => updateSettings.mutateAsync({ ignoreSpicesInPantry: value === true }))
const saveChildFactor = (value: number) =>
  run(() => updateSettings.mutateAsync({ childPortionFactor: value }))

const showLogout = canLogout(location.hostname)
const exporting = ref(false)
const exportingRecipes = ref(false)

async function exportData() {
  exporting.value = true
  try {
    await downloadFile('/export', 'kucharska-kniha-export.json')
    snackbar.value = { show: true, text: t('settings.export.exported'), color: 'success' }
  } catch (e) {
    const text = e instanceof ApiError ? errorText(e) : t('settings.export.failed')
    snackbar.value = { show: true, text, color: 'error' }
  } finally {
    exporting.value = false
  }
}
async function exportRecipes() {
  exportingRecipes.value = true
  try {
    await downloadFile('/export/recipes.md', 'kucharska-kniha-recepty.md')
    snackbar.value = { show: true, text: t('settings.export.recipesExported'), color: 'success' }
  } catch (e) {
    const text = e instanceof ApiError ? errorText(e) : t('settings.export.recipesFailed')
    snackbar.value = { show: true, text, color: 'error' }
  } finally {
    exportingRecipes.value = false
  }
}
</script>

<template>
  <PageHeader :title="t('common.nav.settings')" />

  <div class="d-flex flex-column ga-4">
    <v-card :title="t('settings.account.title')">
      <v-card-text>
        <v-skeleton-loader v-if="isPending" type="list-item-two-line" />
        <v-alert v-else-if="error" type="error" :text="errorText(error)" />
        <template v-else-if="me">
          <div class="text-body-1 font-weight-bold">{{ me.user.name }}</div>
          <div class="text-body-2 text-medium-emphasis">{{ me.user.email }}</div>
          <I18nT keypath="settings.account.household" scope="global" tag="div" class="text-body-2 mt-3">
            <template #name
              ><strong>{{ me.household.name }}</strong></template
            >
            <template #people>{{ tc('common.plural.people', me.members.length) }}</template>
          </I18nT>
        </template>
      </v-card-text>
    </v-card>

    <div class="text-overline">{{ t('settings.mine') }}</div>
    <LanguageCard />
    <v-card :title="t('settings.appearance.title')">
      <v-card-text>
        <v-btn-toggle
          :model-value="themePreference"
          mandatory
          selected-class="bg-primary"
          variant="outlined"
          divided
          :aria-label="t('settings.appearance.aria')"
          @update:model-value="setTheme($event)"
        >
          <v-btn value="system">{{ t('settings.appearance.system') }}</v-btn>
          <v-btn value="light">{{ t('settings.appearance.light') }}</v-btn>
          <v-btn value="dark">{{ t('settings.appearance.dark') }}</v-btn>
        </v-btn-toggle>
      </v-card-text>
    </v-card>

    <v-card v-if="me" :title="t('settings.kids.title')">
      <v-card-text>
        <v-switch
          :model-value="kidsEnabled"
          color="primary"
          :label="t('settings.kids.label')"
          :hint="t('settings.kids.hint')"
          persistent-hint
          data-test="kids-switch"
          @update:model-value="saveKids"
        />
      </v-card-text>
    </v-card>

    <v-card :title="t('settings.capture.title')" data-test="capture-card">
      <v-card-text class="d-flex flex-column ga-4">
        <div>
          <div class="text-subtitle-1 font-weight-bold mb-1">{{ t('settings.capture.bookmarkTitle') }}</div>
          <p class="text-body-2 mb-3">{{ t('settings.capture.bookmarkText') }}</p>
          <!-- Odkaz je len na pretiahnutie; kliknutie v nastaveniach by otvorilo import stránky nastavení. -->
          <v-btn
            :href="bookmarklet"
            :prepend-icon="mdiBookmarkPlusOutline"
            color="primary"
            variant="tonal"
            draggable="true"
            data-test="bookmarklet"
            @click.prevent
          >
            {{ t('settings.capture.bookmarkButton') }}
          </v-btn>
          <p class="text-caption text-medium-emphasis mt-2">{{ t('settings.capture.bookmarkHint') }}</p>
        </div>
        <v-divider />
        <div>
          <div class="text-subtitle-1 font-weight-bold mb-1">{{ t('settings.capture.extensionTitle') }}</div>
          <p class="text-body-2 mb-3">{{ t('settings.capture.extensionText') }}</p>
          <v-btn
            href="/rozsirenie-kucharska-kniha.zip"
            download
            :prepend-icon="mdiPuzzleOutline"
            variant="tonal"
            data-test="extension-download"
          >
            {{ t('settings.capture.extensionDownload') }}
          </v-btn>
          <ol class="text-body-2 mt-3 ps-5">
            <li>{{ t('settings.capture.step1') }}</li>
            <li>{{ t('settings.capture.step2') }}</li>
            <li>{{ t('settings.capture.step3') }}</li>
            <li>{{ t('settings.capture.step4') }}</li>
          </ol>
          <div class="d-flex align-center ga-2 mt-2">
            <code class="text-body-2" data-test="app-address">{{ appAddress }}</code>
            <v-btn
              :icon="mdiContentCopy"
              size="small"
              variant="text"
              :aria-label="t('settings.capture.copyAddress')"
              data-test="copy-address"
              @click="copyAddress"
            />
          </div>
        </div>
      </v-card-text>
    </v-card>

    <div class="text-overline">{{ t('settings.household') }}</div>
    <v-alert v-if="me && !isOwner" type="info" density="compact" data-test="owner-only-note">
      {{ t('settings.ownerOnly') }}
    </v-alert>
    <HouseholdMembersCard v-if="me" :is-owner="isOwner" />

    <v-card v-if="me" :title="t('settings.plan.title')">
      <v-card-text class="d-flex flex-column ga-4">
        <div>
          <div class="text-subtitle-2 mb-1">{{ t('settings.plan.slots') }}</div>
          <p class="text-caption text-medium-emphasis mb-1">
            {{ t('settings.plan.slotsHint') }}
          </p>
          <v-switch
            v-for="slot in me.slots"
            :key="slot.id"
            :model-value="slot.isEnabled"
            :label="slotName(slot.name)"
            color="primary"
            density="compact"
            hide-details
            :disabled="!isOwner"
            @update:model-value="toggleSlot(slot.id, $event)"
          />
        </div>
        <v-select
          :model-value="me.settings.weekStartsOn"
          :items="WEEK_STARTS"
          :label="t('settings.plan.weekStart')"
          hide-details
          :disabled="!isOwner"
          @update:model-value="setWeekStart($event)"
        />
        <div>
          <div class="d-flex align-baseline justify-space-between">
            <span class="text-subtitle-2">{{ t('settings.plan.childPortion') }}</span>
            <span class="text-body-2 font-weight-bold">{{
              t('settings.plan.factorTimesAdult', { factor: formatNumber(childFactor) })
            }}</span>
          </div>
          <v-slider
            v-model="childFactor"
            :min="0.25"
            :max="1.5"
            :step="0.05"
            color="primary"
            hide-details
            :disabled="!isOwner"
            @end="saveChildFactor"
          />
          <p class="text-caption text-medium-emphasis">{{ t('settings.plan.childPortionHint') }}</p>
        </div>
      </v-card-text>
    </v-card>

    <v-card v-if="me && isOwner" :title="t('samples.title')" data-test="samples-card">
      <v-card-text class="text-body-2">{{ t('samples.text') }}</v-card-text>
      <v-card-actions class="px-4 pb-4 ga-2 flex-wrap">
        <SampleRecipesButton />
        <SampleRecipesButton v-if="kidsEnabled" set="kids" class="ms-0" />
      </v-card-actions>
    </v-card>

    <v-card v-if="me" :title="t('settings.pantry.title')">
      <v-card-text>
        <v-switch
          :model-value="me.settings.ignoreSpicesInPantry === true"
          color="primary"
          :label="t('settings.pantry.ignoreSpices')"
          :hint="t('settings.pantry.ignoreSpicesHint')"
          persistent-hint
          :disabled="!isOwner"
          data-test="ignore-spices"
          @update:model-value="saveIgnoreSpices"
        />
      </v-card-text>
    </v-card>

    <v-card v-if="me" :title="t('settings.account.title')">
      <v-card-text class="text-body-2">
        <I18nT keypath="settings.account.loggedIn" scope="global" tag="span">
          <template #email
            ><strong>{{ me.user.email }}</strong></template
          >
        </I18nT>
      </v-card-text>
      <v-card-actions v-if="showLogout">
        <v-btn :href="ACCESS_LOGOUT_PATH" :prepend-icon="mdiLogout" data-test="logout-settings">
          {{ t('settings.account.logout') }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <v-card v-if="isOwner" :title="t('settings.export.title')" data-test="export-card">
      <v-card-text class="text-body-2">
        {{ t('settings.export.intro') }}
      </v-card-text>
      <v-card-actions class="flex-wrap ga-2">
        <v-btn color="primary" :prepend-icon="mdiDownload" :loading="exporting" @click="exportData">
          {{ t('settings.export.exportData') }}
        </v-btn>
        <v-btn
          variant="tonal"
          :prepend-icon="mdiFileDocumentOutline"
          :loading="exportingRecipes"
          data-test="export-recipes"
          @click="exportRecipes"
        >
          {{ t('settings.export.recipesMarkdown') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
    {{ snackbar.text }}
  </v-snackbar>
</template>
