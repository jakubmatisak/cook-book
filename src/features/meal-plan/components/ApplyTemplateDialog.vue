<script setup lang="ts">
import { mdiDeleteOutline } from '@mdi/js'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TemplateApplyResult } from '@shared/api'
import { useApplyTemplate, useDeleteTemplate, useTemplates } from '@/api/plan'
import { errorText } from '@/i18n/errors'
import { formatWeekRange, tc } from '@/i18n/format'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
const props = defineProps<{ toDate: string }>()
const emit = defineEmits<{ applied: [result: TemplateApplyResult] }>()

const { data: templates, isPending } = useTemplates()
const apply = useApplyTemplate()
const remove = useDeleteTemplate()

const selected = ref<string | null>(null)
const replace = ref(false)
const error = ref('')
const confirmDeleteId = ref<string | null>(null)

watch(open, (isOpen) => {
  if (!isOpen) return
  selected.value = null
  replace.value = false
  error.value = ''
  confirmDeleteId.value = null
})

async function onApply() {
  if (!selected.value) return void (error.value = t('plan.applyTemplate.pick'))
  try {
    emit(
      'applied',
      await apply.mutateAsync({ id: selected.value, toDate: props.toDate, replace: replace.value }),
    )
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'plan.applyTemplate.applyFailed')
  }
}

async function onDelete(id: string) {
  try {
    await remove.mutateAsync(id)
    if (selected.value === id) selected.value = null
    confirmDeleteId.value = null
  } catch (e) {
    error.value = errorText(e, 'plan.applyTemplate.deleteFailed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="480">
    <v-card :title="t('plan.applyTemplate.title')">
      <v-card-text class="d-flex flex-column ga-3">
        <p class="text-body-medium text-medium-emphasis">
          {{ t('plan.applyTemplate.text', { week: formatWeekRange(toDate) }) }}
        </p>
        <v-skeleton-loader v-if="isPending" type="list-item@2" />
        <p v-else-if="!templates?.length" class="text-body-medium">
          {{ t('plan.applyTemplate.empty') }}
        </p>
        <v-radio-group v-else v-model="selected" hide-details>
          <div v-for="tpl in templates" :key="tpl.id" class="d-flex align-center">
            <v-radio
              :value="tpl.id"
              :label="
                t('plan.applyTemplate.item', {
                  name: tpl.name,
                  meals: tc('common.plural.meals', tpl.entryCount),
                })
              "
              color="primary"
              class="flex-grow-1"
            />
            <v-btn
              v-if="confirmDeleteId !== tpl.id"
              :icon="mdiDeleteOutline"
              size="small"
              variant="text"
              :aria-label="t('plan.applyTemplate.deleteAria', { name: tpl.name })"
              @click="confirmDeleteId = tpl.id"
            />
            <v-btn
              v-else
              color="error"
              size="small"
              :loading="remove.isPending.value"
              @click="onDelete(tpl.id)"
            >
              {{ t('plan.confirmDelete') }}
            </v-btn>
          </div>
        </v-radio-group>
        <v-checkbox
          v-if="templates?.length"
          v-model="replace"
          :label="t('plan.replaceExisting')"
          hide-details
          density="compact"
        />
        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn
          color="primary"
          :disabled="!templates?.length"
          :loading="apply.isPending.value"
          @click="onApply"
        >
          {{ t('plan.applyTemplate.apply') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
