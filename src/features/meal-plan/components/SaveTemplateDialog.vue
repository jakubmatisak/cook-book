<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WeekTemplateDto } from '@shared/api'
import { useSaveTemplate } from '@/api/plan'
import { errorText } from '@/i18n/errors'
import { formatWeekRange, tc } from '@/i18n/format'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
const props = defineProps<{ fromDate: string; entryCount: number }>()
const emit = defineEmits<{ saved: [template: WeekTemplateDto] }>()

const name = ref('')
const error = ref('')
const save = useSaveTemplate()

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = ''
  error.value = ''
})

async function onSave() {
  const value = name.value.trim()
  if (!value) return void (error.value = t('plan.saveTemplate.nameRequired'))
  try {
    emit('saved', await save.mutateAsync({ name: value, fromDate: props.fromDate }))
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'plan.saveTemplate.saveFailed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card :title="t('plan.saveTemplate.title')">
      <v-card-text class="d-flex flex-column ga-3">
        <p class="text-body-2 text-medium-emphasis">
          {{
            t('plan.saveTemplate.text', {
              meals: tc('common.plural.meals', entryCount),
              week: formatWeekRange(fromDate),
            })
          }}
        </p>
        <v-text-field
          v-model="name"
          autocomplete="off"
          :label="t('plan.saveTemplate.name')"
          :placeholder="t('plan.saveTemplate.namePlaceholder')"
          maxlength="60"
          autofocus
          hide-details="auto"
          :error-messages="error"
          @keydown.enter="onSave"
        />
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn color="primary" :loading="save.isPending.value" @click="onSave">{{
          t('common.actions.save')
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
