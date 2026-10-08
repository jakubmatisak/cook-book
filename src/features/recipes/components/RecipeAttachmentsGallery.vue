<script setup lang="ts">
import { mdiClose } from '@mdi/js'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RecipeAttachmentDto } from '@shared/api'

defineProps<{ attachments: RecipeAttachmentDto[] }>()
const { t } = useI18n()

// Náhľady v riadku; klik otvorí prílohu na celú obrazovku, kde sa dá listovať (šípky aj potiahnutím prsta).
const open = ref(false)
const current = ref(0)

function show(index: number) {
  current.value = index
  open.value = true
}
</script>

<template>
  <v-card :title="t('recipes.attachments.title')" class="d-print-none" data-test="recipe-attachments">
    <v-card-text class="d-flex flex-wrap ga-2">
      <v-card
        v-for="(item, index) in attachments"
        :key="item.id"
        width="120"
        variant="outlined"
        :aria-label="t('recipes.attachments.open', { n: index + 1 })"
        data-test="attachment-thumb"
        @click="show(index)"
      >
        <v-img :src="item.url" :aspect-ratio="3 / 4" cover />
      </v-card>
    </v-card-text>
  </v-card>

  <v-dialog v-model="open" fullscreen>
    <v-card data-test="attachment-viewer">
      <v-toolbar density="compact">
        <v-toolbar-title class="text-body-large">
          {{ t('recipes.attachments.counter', { n: current + 1, total: attachments.length }) }}
        </v-toolbar-title>
        <v-btn :icon="mdiClose" :aria-label="t('recipes.attachments.close')" @click="open = false" />
      </v-toolbar>
      <v-window v-model="current" show-arrows class="flex-grow-1">
        <v-window-item v-for="item in attachments" :key="item.id" class="h-100">
          <v-img :src="item.url" contain height="calc(100dvh - 48px)" />
        </v-window-item>
      </v-window>
    </v-card>
  </v-dialog>
</template>
