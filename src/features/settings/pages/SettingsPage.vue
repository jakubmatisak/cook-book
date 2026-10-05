<script setup lang="ts">
import { mdiDownload } from '@mdi/js'
import { ref } from 'vue'
import { ApiError, downloadFile } from '@/api/http'
import { useMe } from '@/api/me'

const { data: me, isPending, error } = useMe()

const exporting = ref(false)
const snackbar = ref({ show: false, text: '', color: 'error' })

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
</script>

<template>
  <h1 class="text-h5 tw:mb-4">Nastavenia</h1>

  <div class="tw:flex tw:flex-col tw:gap-4">
    <v-card title="Účet">
      <v-card-text>
        <v-skeleton-loader v-if="isPending" type="list-item-two-line" />
        <v-alert v-else-if="error" type="error" variant="tonal" :text="error.message" />
        <template v-else-if="me">
          <div class="text-body-1 tw:font-semibold">{{ me.user.name }}</div>
          <div class="text-body-2 text-medium-emphasis">{{ me.user.email }}</div>
          <div class="text-body-2 tw:mt-3">
            Domácnosť: <strong>{{ me.household.name }}</strong> · {{ me.slots.length }} jedál v dni ·
            {{ me.members.length }} členov
          </div>
        </template>
      </v-card-text>
    </v-card>

    <v-card title="Záloha dát">
      <v-card-text class="text-body-2">
        Stiahne všetky recepty, jedálničky a zoznamy ako JSON súbor. Odporúčame raz za mesiac.
      </v-card-text>
      <v-card-actions>
        <v-btn color="primary" variant="flat" :prepend-icon="mdiDownload" :loading="exporting" @click="exportData">
          Exportovať dáta
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
    {{ snackbar.text }}
  </v-snackbar>
</template>
