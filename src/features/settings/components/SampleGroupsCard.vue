<script setup lang="ts">
import { mdiDeleteOutline, mdiPlus } from '@mdi/js'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SampleGroup } from '@shared/data/sampleSets'
import { useAddSampleRecipes, useRemoveSampleGroup, useSampleStatus } from '@/api/recipes'
import { errorText } from '@/i18n/errors'
import { tc } from '@/i18n/format'

const props = defineProps<{ kidsEnabled: boolean }>()
const { t } = useI18n()

const { data: status } = useSampleStatus()
const groups = computed(() => (status.value ?? []).filter((g) => props.kidsEnabled || g.set !== 'kids'))
const add = useAddSampleRecipes()
const remove = useRemoveSampleGroup()
const busy = ref<SampleGroup | null>(null)
const removing = ref<{ set: SampleGroup; imported: number } | null>(null)
const snackbar = ref({ show: false, text: '', color: 'success' })
const notify = (text: string, color = 'success') => (snackbar.value = { show: true, text, color })
const groupName = (set: SampleGroup) => t(`samples.groups.${set}`)

async function onAdd(set: SampleGroup) {
  busy.value = set
  try {
    const added = await add.mutateAsync(set)
    notify(
      added > 0 ? t('samples.added', { recipes: tc('common.plural.recipes', added) }) : t('samples.none'),
    )
  } catch (e) {
    notify(errorText(e), 'error')
  } finally {
    busy.value = null
  }
}

async function onRemove() {
  const target = removing.value
  if (!target) return
  try {
    const removed = await remove.mutateAsync(target.set)
    removing.value = null
    notify(t('samples.removed', { recipes: tc('common.plural.recipes', removed) }))
  } catch (e) {
    notify(errorText(e), 'error')
  }
}
</script>

<template>
  <v-card :title="t('samples.title')" data-test="samples-card">
    <v-card-text class="d-flex flex-column ga-3">
      <p class="text-body-medium">{{ t('samples.text') }}</p>
      <v-skeleton-loader v-if="!status" type="list-item@4" />
      <v-list v-else density="compact" class="pa-0" bg-color="transparent">
        <v-list-item
          v-for="group in groups"
          :key="group.set"
          :title="groupName(group.set)"
          :subtitle="t('samples.status', { imported: group.imported, total: group.total })"
          class="px-0"
          :data-test="`sample-group-${group.set}`"
        >
          <template #append>
            <div class="d-flex ga-1">
              <v-btn
                :prepend-icon="mdiPlus"
                size="small"
                variant="tonal"
                color="primary"
                :disabled="group.imported >= group.total || (busy !== null && busy !== group.set)"
                :loading="busy === group.set"
                data-test="sample-add"
                @click="onAdd(group.set)"
              >
                {{ t('samples.add') }}
              </v-btn>
              <v-btn
                :icon="mdiDeleteOutline"
                size="small"
                variant="text"
                color="error"
                :aria-label="t('samples.remove')"
                :title="t('samples.remove')"
                :disabled="!group.imported || busy !== null"
                data-test="sample-remove"
                @click="removing = { set: group.set, imported: group.imported }"
              />
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>

  <v-dialog :model-value="!!removing" max-width="440" @update:model-value="removing = null">
    <v-card
      v-if="removing"
      :title="t('samples.removeDialog.title', { group: groupName(removing.set) })"
      data-test="sample-remove-dialog"
    >
      <v-card-text>
        {{ t('samples.removeDialog.text', { recipes: tc('common.plural.recipes', removing.imported) }) }}
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="removing = null">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn
          color="error"
          variant="flat"
          :loading="remove.isPending.value"
          data-test="sample-remove-confirm"
          @click="onRemove"
        >
          {{ t('samples.removeDialog.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">{{ snackbar.text }}</v-snackbar>
</template>
