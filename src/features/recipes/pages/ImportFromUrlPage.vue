<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useImportRecipe } from '@/api/recipes'
import { errorText } from '@/i18n/errors'
import { importHandoff } from '../importHandoff'
import { importTargetFromQuery } from '../importUrl'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const importer = useImportRecipe()

const target = importTargetFromQuery(route.query.url)
const error = ref('')

/** Načíta recept z adresy v URL (rozšírenie do Chromu, záložka) a otvorí predvyplnený editor. */
async function run() {
  if (!target) return void router.replace('/recipes')
  error.value = ''
  try {
    importHandoff.put(await importer.mutateAsync(target))
    await router.replace({ path: '/recipes/new', query: { import: '1' } })
  } catch (e) {
    error.value = errorText(e, 'recipes.import.failed')
  }
}

onMounted(run)
</script>

<template>
  <div class="d-flex flex-column align-center text-center ga-4 py-8">
    <template v-if="error">
      <v-alert type="error" :text="error" max-width="32rem" data-test="import-error" />
      <p class="text-body-medium text-medium-emphasis text-break">{{ target }}</p>
      <div class="d-flex flex-wrap justify-center ga-2">
        <v-btn color="primary" data-test="import-retry" @click="run">{{
          t('recipes.importFromUrl.retry')
        }}</v-btn>
        <v-btn variant="tonal" to="/recipes/new" replace data-test="import-manual">{{
          t('recipes.importFromUrl.manual')
        }}</v-btn>
      </div>
    </template>
    <template v-else>
      <v-progress-circular indeterminate color="primary" />
      <p class="text-body-large">{{ t('recipes.importFromUrl.loading') }}</p>
      <p class="text-body-medium text-medium-emphasis text-break">{{ target }}</p>
    </template>
  </div>
</template>
