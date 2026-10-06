<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import { usePrintMode } from '@/composables/usePrintMode'

const { mdAndUp } = useDisplay()
const printing = usePrintMode()
const pinned = computed(() => mdAndUp.value)

// Stránka so zoznamom má presne výšku okna (mínus horná a spodná lišta a odsadenie kontajnera pa-4 / pa-md-6),
// takže sa nehýbe celá; posúva sa len zoznam pod hlavičkou. Pri tlači sa obsah nerozdeľuje na posúvanú časť.
const heightStyle = computed(() =>
  printing.value
    ? undefined
    : {
        height: `calc(100dvh - var(--v-layout-top, 0px) - var(--v-layout-bottom, 0px) - ${mdAndUp.value ? 48 : 32}px)`,
      },
)
</script>

<template>
  <!-- Hlavička (nadpis, hľadanie, filtre) ostáva hore, pod ňou sa posúva len obsah. Na mobile by zaberala príliš
       veľa miesta, tam sa posúva spolu so zoznamom. -->
  <div class="d-flex flex-column" :style="heightStyle" data-test="list-layout">
    <div v-if="pinned" class="flex-shrink-0 pb-1" data-test="list-header">
      <slot name="header" />
    </div>
    <div
      class="flex-grow-1"
      :class="{ 'overflow-y-auto': !printing }"
      style="min-height: 0"
      data-test="list-body"
    >
      <div v-if="!pinned" data-test="list-header">
        <slot name="header" />
      </div>
      <slot />
    </div>
  </div>
</template>
