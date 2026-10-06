<script setup lang="ts">
import { mdiDownload, mdiFileDocumentOutline, mdiLogout } from '@mdi/js'
import { ref, watch } from 'vue'
import { useUpdateSettings, useUpdateSlot } from '@/api/family'
import { ApiError, downloadFile } from '@/api/http'
import { useIsOwner, useMe } from '@/api/me'
import PageHeader from '@/components/PageHeader.vue'
import HouseholdMembersCard from '@/features/households/components/HouseholdMembersCard.vue'
import LanguageCard from '../components/LanguageCard.vue'
import { useThemePreference } from '@/composables/useThemePreference'
import { ACCESS_LOGOUT_PATH, canLogout } from '@/lib/auth'
import { plural } from '@/lib/format'

const { data: me, isPending, error } = useMe()
const isOwner = useIsOwner()

const { preference: themePreference, set: setTheme } = useThemePreference()

const snackbar = ref({ show: false, text: '', color: 'error' })
const updateSlot = useUpdateSlot()
const updateSettings = useUpdateSettings()

const WEEK_STARTS: { value: 0 | 1 | 6; title: string }[] = [
  { value: 1, title: 'Pondelok' },
  { value: 0, title: 'Nedeľa' },
  { value: 6, title: 'Sobota' },
]

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
      text: e instanceof Error ? e.message : 'Zmena sa neuložila.',
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
const formatFactor = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

const showLogout = canLogout(location.hostname)
const exporting = ref(false)
const exportingRecipes = ref(false)

async function exportData() {
  exporting.value = true
  try {
    await downloadFile('/export', 'kucharska-kniha-export.json')
    snackbar.value = { show: true, text: 'Export stiahnutý.', color: 'success' }
  } catch (e) {
    const text = e instanceof ApiError ? e.message : 'Export sa nepodaril.'
    snackbar.value = { show: true, text, color: 'error' }
  } finally {
    exporting.value = false
  }
}
async function exportRecipes() {
  exportingRecipes.value = true
  try {
    await downloadFile('/export/recipes.md', 'kucharska-kniha-recepty.md')
    snackbar.value = { show: true, text: 'Recepty stiahnuté.', color: 'success' }
  } catch (e) {
    const text = e instanceof ApiError ? e.message : 'Export receptov sa nepodaril.'
    snackbar.value = { show: true, text, color: 'error' }
  } finally {
    exportingRecipes.value = false
  }
}
</script>

<template>
  <PageHeader title="Nastavenia" />

  <div class="d-flex flex-column ga-4">
    <v-card title="Účet">
      <v-card-text>
        <v-skeleton-loader v-if="isPending" type="list-item-two-line" />
        <v-alert v-else-if="error" type="error" :text="error.message" />
        <template v-else-if="me">
          <div class="text-body-1 font-weight-bold">{{ me.user.name }}</div>
          <div class="text-body-2 text-medium-emphasis">{{ me.user.email }}</div>
          <div class="text-body-2 mt-3">
            Domácnosť: <strong>{{ me.household.name }}</strong> ·
            {{ plural(me.members.length, 'osoba', 'osoby', 'osôb') }} v rodine
          </div>
        </template>
      </v-card-text>
    </v-card>

    <div class="text-overline">Moje nastavenia</div>
    <LanguageCard />
    <v-card title="Vzhľad">
      <v-card-text>
        <v-btn-toggle
          :model-value="themePreference"
          mandatory
          selected-class="bg-primary"
          variant="outlined"
          divided
          aria-label="Svetlý alebo tmavý vzhľad"
          @update:model-value="setTheme($event)"
        >
          <v-btn value="system">Podľa zariadenia</v-btn>
          <v-btn value="light">Svetlý</v-btn>
          <v-btn value="dark">Tmavý</v-btn>
        </v-btn-toggle>
      </v-card-text>
    </v-card>

    <div class="text-overline">Domácnosť</div>
    <v-alert v-if="me && !isOwner" type="info" density="compact" data-test="owner-only-note">
      Nastavenia domácnosti môže meniť len vlastník.
    </v-alert>
    <HouseholdMembersCard v-if="me" :is-owner="isOwner" />

    <v-card v-if="me" title="Jedálniček">
      <v-card-text class="d-flex flex-column ga-4">
        <div>
          <div class="text-subtitle-2 mb-1">Jedlá dňa</div>
          <p class="text-caption text-medium-emphasis mb-1">
            Vypnuté jedlá sa v pláne nezobrazujú, kým v nich nič nie je.
          </p>
          <v-switch
            v-for="slot in me.slots"
            :key="slot.id"
            :model-value="slot.isEnabled"
            :label="slot.name"
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
          label="Týždeň začína"
          hide-details
          :disabled="!isOwner"
          @update:model-value="setWeekStart($event)"
        />
        <div>
          <div class="d-flex align-baseline justify-space-between">
            <span class="text-subtitle-2">Predvolená porcia dieťaťa</span>
            <span class="text-body-2 font-weight-bold">{{ formatFactor(childFactor) }} × dospelý</span>
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
          <p class="text-caption text-medium-emphasis">Použije sa pri pridaní nového dieťaťa v Rodine.</p>
        </div>
      </v-card-text>
    </v-card>

    <v-card v-if="me" title="Špajza a recepty">
      <v-card-text>
        <v-switch
          :model-value="me.settings.ignoreSpicesInPantry === true"
          color="primary"
          label="Pri „Čo viem uvariť“ ignorovať koreniny"
          hint="Koreniny sa nepočítajú ako chýbajúce, takže uvidíš aj recepty, ktoré viem uvariť bez nich."
          persistent-hint
          :disabled="!isOwner"
          data-test="ignore-spices"
          @update:model-value="saveIgnoreSpices"
        />
      </v-card-text>
    </v-card>

    <v-card v-if="me" title="Účet">
      <v-card-text class="text-body-2">
        Prihlásený ako <strong>{{ me.user.email }}</strong
        >. Odhlásením sa tento prehliadač zabudne a pri ďalšom otvorení sa treba prihlásiť znova.
      </v-card-text>
      <v-card-actions v-if="showLogout">
        <v-btn :href="ACCESS_LOGOUT_PATH" :prepend-icon="mdiLogout" data-test="logout-settings">
          Odhlásiť sa
        </v-btn>
      </v-card-actions>
    </v-card>

    <v-card v-if="isOwner" title="Záloha a export" data-test="export-card">
      <v-card-text class="text-body-2">
        Záloha stiahne všetky recepty, jedálničky a zoznamy ako JSON súbor, odporúčame ju raz za mesiac.
        Recepty vieš stiahnuť aj ako čitateľný textový súbor (Markdown). Tlač do PDF nájdeš pri recepte,
        jedálničku a nákupe v menu Tlačiť, v okne tlače zvoľ Uložiť ako PDF.
      </v-card-text>
      <v-card-actions class="flex-wrap ga-2">
        <v-btn color="primary" :prepend-icon="mdiDownload" :loading="exporting" @click="exportData">
          Exportovať dáta
        </v-btn>
        <v-btn
          variant="tonal"
          :prepend-icon="mdiFileDocumentOutline"
          :loading="exportingRecipes"
          data-test="export-recipes"
          @click="exportRecipes"
        >
          Recepty ako Markdown
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
    {{ snackbar.text }}
  </v-snackbar>
</template>
