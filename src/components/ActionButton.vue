<script setup lang="ts">
import { useDisplay } from 'vuetify'
import { useControlHeight } from '@/composables/useDensity'

/**
 * Akcia v hlavičke stránky: na počítači tlačidlo s ikonkou a textom, na mobile len ikonka (text je v aria-label),
 * nech hlavička nezaberá pol obrazovky. Ikonka má veľkosť poľa, aby sa dala pohodlne stlačiť prstom.
 * Ostatné atribúty (color, variant, to, @click, data-test) idú na v-btn.
 */
defineProps<{ icon: string; label: string }>()
const { mdAndUp } = useDisplay()
const controlHeight = useControlHeight()
</script>

<template>
  <v-btn v-if="mdAndUp" :prepend-icon="icon">{{ label }}</v-btn>
  <v-btn v-else :icon="icon" :aria-label="label" :height="controlHeight" :width="controlHeight" />
</template>
