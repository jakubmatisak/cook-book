<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ notes: string }>()
const { t } = useI18n()
</script>

<template>
  <!-- Poznámky sa ukážu tak, ako boli napísané – s riadkami aj prázdnymi riadkami medzi odsekmi. -->
  <v-card :title="t('recipes.detail.notes')" data-test="recipe-notes">
    <v-card-text class="text-body-medium text-pre-wrap">{{ notes }}</v-card-text>
  </v-card>
</template>
