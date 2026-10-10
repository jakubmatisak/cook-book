<script setup lang="ts">
import {
  mdiAccountMultiplePlusOutline,
  mdiCallMerge,
  mdiClose,
  mdiDeleteOutline,
  mdiPencilOutline,
} from '@mdi/js'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
/** `mergeable`: zobrazí aj Zlúčiť (ingrediencie), dostupné od dvoch vybraných; `shareable`: aj Zdieľať s… (recepty). */
defineProps<{ count: number; total: number; mergeable?: boolean; shareable?: boolean }>()
defineEmits<{ selectAll: []; clear: []; edit: []; merge: []; share: []; remove: []; close: [] }>()
</script>

<template>
  <!-- Lišta hromadných úprav: počet vybraných a akcie nad zoznamom. -->
  <v-card variant="tonal" color="primary" class="mb-3 d-print-none" data-test="bulk-bar">
    <div class="d-flex flex-wrap align-center ga-2 pa-2">
      <v-btn
        :icon="mdiClose"
        size="small"
        variant="text"
        :aria-label="t('bulk.done')"
        data-test="bulk-close"
        @click="$emit('close')"
      />
      <span class="font-weight-bold me-2" data-test="bulk-count">{{ t('bulk.selected', { n: count }) }}</span>
      <v-btn
        v-if="count < total"
        size="small"
        variant="text"
        data-test="bulk-select-all"
        @click="$emit('selectAll')"
        >{{ t('bulk.selectAll') }}</v-btn
      >
      <v-btn v-if="count > 0" size="small" variant="text" data-test="bulk-clear" @click="$emit('clear')">{{
        t('bulk.selectNone')
      }}</v-btn>
      <v-spacer />
      <v-btn
        :prepend-icon="mdiPencilOutline"
        variant="flat"
        color="primary"
        :disabled="count === 0"
        data-test="bulk-edit"
        @click="$emit('edit')"
      >
        {{ t('bulk.edit') }}
      </v-btn>
      <v-btn
        v-if="mergeable"
        :prepend-icon="mdiCallMerge"
        variant="flat"
        color="primary"
        :disabled="count < 2"
        data-test="bulk-merge"
        @click="$emit('merge')"
      >
        {{ t('bulk.merge') }}
      </v-btn>
      <v-btn
        v-if="shareable"
        :prepend-icon="mdiAccountMultiplePlusOutline"
        variant="flat"
        color="primary"
        :disabled="count === 0"
        data-test="bulk-share"
        @click="$emit('share')"
      >
        {{ t('sharing.shareWith') }}
      </v-btn>
      <v-btn
        :prepend-icon="mdiDeleteOutline"
        variant="flat"
        color="error"
        :disabled="count === 0"
        data-test="bulk-remove"
        @click="$emit('remove')"
      >
        {{ t('bulk.remove') }}
      </v-btn>
    </div>
  </v-card>
</template>
