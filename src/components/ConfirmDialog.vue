<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
withDefaults(defineProps<{ title: string; text: string; confirmLabel: string; loading?: boolean }>(), {
  loading: false,
})
defineEmits<{ confirm: [] }>()
</script>

<template>
  <v-dialog v-model="open" max-width="440" :persistent="loading">
    <v-card :title="title" :text="text">
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="loading" data-test="confirm-cancel" @click="open = false">{{
          t('common.actions.cancel')
        }}</v-btn>
        <v-btn
          color="error"
          variant="flat"
          :loading="loading"
          data-test="confirm-ok"
          @click="$emit('confirm')"
          >{{ confirmLabel }}</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
