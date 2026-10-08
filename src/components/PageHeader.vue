<script setup lang="ts">
import { useDisplay } from 'vuetify'

defineProps<{ title: string; subtitle?: string }>()
// Na mobile menší nadpis (22 px namiesto 32 px) a menšia medzera, aby hlavička nezaberala veľa miesta. Triedy
// sú z typografie Vuetify 4 (MD3); staré text-h5/text-h6 vo Vuetify 4 neexistujú.
const { smAndDown } = useDisplay()
</script>

<template>
  <!-- Jednotná hlavička stránky: nadpis a akcie vedľa seba; keď sa akcie nezmestia, zalomia sa pod nadpis. -->
  <div class="d-flex flex-wrap align-center ga-2" :class="smAndDown ? 'mb-2' : 'mb-4'">
    <div class="me-auto">
      <h1
        class="font-weight-bold"
        :class="smAndDown ? 'text-title-large' : 'text-headline-large'"
        data-test="page-title"
      >
        {{ title }}
      </h1>
      <div v-if="subtitle" class="text-body-medium text-medium-emphasis">{{ subtitle }}</div>
    </div>
    <div v-if="$slots.default" class="d-flex flex-wrap align-center ga-2 d-print-none">
      <slot />
    </div>
  </div>
</template>
