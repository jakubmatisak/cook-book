<script setup lang="ts">
import { mdiCheck, mdiHomeOutline } from '@mdi/js'
import { useI18n } from 'vue-i18n'
import type { HouseholdSummaryDto } from '@shared/api'
import EmptyState from '@/components/EmptyState.vue'
import { roleLabel } from '../roles'

const { t } = useI18n()
defineProps<{ households: HouseholdSummaryDto[]; preferred: string | null }>()
defineEmits<{ pick: [id: string] }>()
</script>

<template>
  <v-container class="pa-0" style="max-width: 32rem">
    <EmptyState
      :icon="mdiHomeOutline"
      :title="t('households.picker.title')"
      :text="t('households.picker.text')"
    />
    <v-list lines="two" border data-test="household-picker">
      <v-list-item
        v-for="h in households"
        :key="h.id"
        :title="h.name"
        :subtitle="roleLabel(h.role)"
        :prepend-icon="mdiHomeOutline"
        :append-icon="h.id === preferred ? mdiCheck : undefined"
        data-test="household-option"
        @click="$emit('pick', h.id)"
      />
    </v-list>
  </v-container>
</template>
