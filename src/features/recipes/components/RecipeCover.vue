<script setup lang="ts">
import { useDisplay } from 'vuetify'

defineProps<{ src: string }>()
// Na úzkom mobile (pod 600 px) je fotka hore na celú šírku. Od 600 px je to menší štvorec vpravo, ktorý text
// hlavičky obteká – fotka sa tak nenaťahuje a ostane ostrá aj z menšieho súboru.
const { xs } = useDisplay()
</script>

<template>
  <v-img
    v-if="xs"
    :src="src"
    :aspect-ratio="16 / 9"
    max-height="420"
    cover
    rounded="md"
    class="mb-4 d-print-none"
    data-test="recipe-cover"
  />
  <v-img
    v-else
    :src="src"
    :aspect-ratio="1"
    cover
    rounded="md"
    class="float-right ms-4 mb-3 d-print-none"
    width="40%"
    max-width="320"
    data-test="recipe-cover"
  />
</template>
