<script setup lang="ts">
import { mdiLinkVariant } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useImportRecipe } from '@/api/recipes'
import { useOnline } from '@/composables/useOnline'
import { errorText } from '@/i18n/errors'
import { importHandoff } from '../importHandoff'
import { normalizeUrl } from '../importUrl'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
const router = useRouter()
const importer = useImportRecipe()
const online = useOnline()

const url = ref('')
const error = ref('')
const loading = computed(() => importer.isPending.value)

watch(open, (isOpen) => {
  if (!isOpen) return
  url.value = ''
  error.value = ''
  importer.reset()
})

async function submit() {
  error.value = ''
  const value = url.value.trim()
  if (!value) {
    error.value = t('recipes.import.enterUrl')
    return
  }
  try {
    const result = await importer.mutateAsync(normalizeUrl(value))
    importHandoff.put(result)
    open.value = false
    await router.push({ path: '/recipes/new', query: { import: '1' } })
  } catch (e) {
    error.value = errorText(e, 'recipes.import.failed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="520" :persistent="loading">
    <v-card :title="t('recipes.import.title')">
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          {{ t('recipes.import.intro') }}
        </p>
        <v-alert v-if="!online" type="warning" density="compact" class="mb-3">
          {{ t('recipes.import.offline') }}
        </v-alert>
        <v-alert v-if="error" type="error" density="compact" class="mb-3" :text="error" />
        <v-text-field
          v-model="url"
          :label="t('recipes.import.urlLabel')"
          placeholder="https://www.example.sk/recept"
          type="url"
          autofocus
          autocomplete="off"
          hide-details="auto"
          :prepend-inner-icon="mdiLinkVariant"
          :disabled="loading"
          @keydown.enter.prevent="submit"
        />
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" :disabled="loading" @click="open = false">{{
          t('common.actions.cancel')
        }}</v-btn>
        <v-btn color="primary" :loading="loading" :disabled="!online" @click="submit">{{
          t('recipes.import.submit')
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
