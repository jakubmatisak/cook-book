<script setup lang="ts"></script>

<template>
  <!-- Lepkavá hlavička stránky so zoznamom: nadpis, hľadanie a filtre ostanú hore, posúva sa len obsah pod nimi.
       Odsadená o výšku hornej lišty (--v-layout-top). -->
  <v-sheet
    position="sticky"
    color="background"
    class="pb-1 d-print-none"
    :style="{ top: 'var(--v-layout-top)', zIndex: 2 }"
    data-test="sticky-header"
  >
    <slot />
  </v-sheet>
</template>
