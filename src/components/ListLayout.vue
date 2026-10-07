<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import { usePrintMode } from '@/composables/usePrintMode'

const { mdAndUp } = useDisplay()
const printing = usePrintMode()

// Stránka so zoznamom má presne výšku okna (mínus horná a spodná lišta a odsadenie kontajnera pa-4 / pa-md-6),
// takže sa nehýbe celá; posúva sa len zoznam pod hlavičkou (s odstupom od posuvníka). Pri tlači sa obsah
// nerozdeľuje na posúvanú časť.
const heightStyle = computed(() =>
  printing.value
    ? undefined
    : {
        height: `calc(100dvh - var(--v-layout-top, 0px) - var(--v-layout-bottom, 0px) - ${mdAndUp.value ? 48 : 32}px)`,
      },
)
</script>

<template>
  <!-- Hlavička (nadpis, hľadanie, filtre) ostáva hore aj na mobile, pod ňou sa posúva len obsah. -->
  <div class="d-flex flex-column" :style="heightStyle" data-test="list-layout">
    <div class="flex-shrink-0 pb-1" data-test="list-header">
      <slot name="header" />
    </div>
    <div
      class="flex-grow-1"
      :class="{ 'overflow-y-auto pe-2': !printing }"
      style="min-height: 0"
      data-test="list-body"
    >
      <slot />
    </div>
  </div>
</template>
