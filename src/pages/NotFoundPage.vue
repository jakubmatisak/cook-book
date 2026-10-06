<script setup lang="ts">
import { mdiMapMarkerQuestionOutline } from '@mdi/js'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/EmptyState.vue'

const { t } = useI18n()
</script>

<template>
  <EmptyState :icon="mdiMapMarkerQuestionOutline" :title="t('common.notFound.title')">
    <v-btn color="primary" to="/recepty">{{ t('common.notFound.back') }}</v-btn>
  </EmptyState>
</template>
