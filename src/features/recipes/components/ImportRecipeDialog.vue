<script setup lang="ts">
import { mdiLinkVariant } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '@/api/http'
import { useImportRecipe } from '@/api/recipes'
import { useOnline } from '@/composables/useOnline'
import { importHandoff } from '../importHandoff'

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

/** Adresa bez úvodného „https://“ (napr. skopírovaná z lišty) sa doplní. */
const normalizeUrl = (value: string) => (/^https?:\/\//i.test(value) ? value : `https://${value}`)

async function submit() {
  error.value = ''
  const value = url.value.trim()
  if (!value) {
    error.value = 'Vlož adresu receptu.'
    return
  }
  try {
    const result = await importer.mutateAsync(normalizeUrl(value))
    importHandoff.put(result)
    open.value = false
    await router.push({ path: '/recepty/novy', query: { import: '1' } })
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Recept sa nepodarilo načítať.'
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="520" :persistent="loading">
    <v-card title="Importovať recept z webu">
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Vlož odkaz na stránku s receptom. Načítame názov, ingrediencie, postup a fotku a ty ich pred
          uložením skontroluješ.
        </p>
        <v-alert v-if="!online" type="warning" density="compact" class="mb-3">
          Si offline, import potrebuje pripojenie.
        </v-alert>
        <v-alert v-if="error" type="error" density="compact" class="mb-3" :text="error" />
        <v-text-field
          v-model="url"
          label="Adresa receptu"
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
        <v-btn variant="text" :disabled="loading" @click="open = false">Zrušiť</v-btn>
        <v-btn color="primary" :loading="loading" :disabled="!online" @click="submit">Načítať recept</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
