<script setup lang="ts">
import { mdiSilverwareForkKnife } from '@mdi/js'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SampleSet } from '@shared/data/sampleSets'
import { useAddSampleRecipes } from '@/api/recipes'
import { errorText } from '@/i18n/errors'
import { tc } from '@/i18n/format'

const props = withDefaults(defineProps<{ variant?: 'flat' | 'tonal' | 'text'; set?: SampleSet }>(), {
  variant: 'tonal',
  set: 'basic',
})

const { t } = useI18n()
const add = useAddSampleRecipes(props.set)
const snackbar = ref({ show: false, text: '', color: 'success' })

/** Pridá ukážkové recepty, ktoré domácnosť ešte nemá (opakované stlačenie nič nezdvojí). */
async function run() {
  try {
    const added = await add.mutateAsync()
    snackbar.value = {
      show: true,
      text:
        added > 0
          ? t('samples.added', { recipes: tc('common.plural.recipes', added) })
          : t(props.set === 'kids' ? 'samples.kidsNone' : 'samples.none'),
      color: 'success',
    }
  } catch (e) {
    snackbar.value = { show: true, text: errorText(e), color: 'error' }
  }
}
</script>

<template>
  <v-btn
    :variant="variant"
    color="primary"
    :prepend-icon="mdiSilverwareForkKnife"
    :loading="add.isPending.value"
    :data-test="set === 'kids' ? 'sample-recipes-kids' : 'sample-recipes'"
    @click="run"
  >
    {{ t(set === 'kids' ? 'samples.kidsButton' : 'samples.button') }}
  </v-btn>
  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="5000">{{ snackbar.text }}</v-snackbar>
</template>
