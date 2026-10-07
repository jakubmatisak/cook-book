<script setup lang="ts">
import { mdiCheck, mdiPencilOutline, mdiPlus, mdiTagMultipleOutline } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TagDto } from '@shared/api'
import { MEMBER_COLORS } from '@shared/family'
import { useDeleteTag, useSaveTag, useTags } from '@/api/catalog'
import EmptyState from '@/components/EmptyState.vue'
import ActionButton from '@/components/ActionButton.vue'
import ListLayout from '@/components/ListLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { errorText } from '@/i18n/errors'
import { tc } from '@/i18n/format'

const { t } = useI18n()
const { data: tags, isPending, error } = useTags()
const save = useSaveTag()
const remove = useDeleteTag()

const dialogOpen = ref(false)
const editing = ref<TagDto | null>(null)
const name = ref('')
const color = ref<string | null>(null)
const formError = ref('')
const confirmDelete = ref(false)

watch(dialogOpen, (open) => {
  if (!open) return
  name.value = editing.value?.name ?? ''
  color.value = editing.value?.color ?? null
  formError.value = ''
  confirmDelete.value = false
})

function openNew() {
  editing.value = null
  dialogOpen.value = true
}

function openEdit(tag: TagDto) {
  editing.value = tag
  dialogOpen.value = true
}

async function onSave() {
  if (!name.value.trim()) return void (formError.value = t('tags.nameRequired'))
  try {
    await save.mutateAsync({ id: editing.value?.id, input: { name: name.value, color: color.value } })
    dialogOpen.value = false
  } catch (e) {
    formError.value = errorText(e, 'tags.saveFailed')
  }
}

async function onDelete() {
  if (!editing.value) return
  try {
    await remove.mutateAsync(editing.value.id)
    dialogOpen.value = false
  } catch (e) {
    formError.value = errorText(e, 'tags.deleteFailed')
  }
}

const subtitle = computed(() => (tags.value?.length ? tc('tags.count', tags.value.length) : undefined))
const usage = (tag: TagDto) =>
  tag.recipeCount ? tc('common.plural.recipes', tag.recipeCount) : t('tags.unused')
</script>

<template>
  <ListLayout>
    <template #header>
      <PageHeader :title="t('common.nav.tags')" :subtitle="subtitle">
        <ActionButton :icon="mdiPlus" :label="t('tags.new')" color="primary" @click="openNew" />
      </PageHeader>
    </template>

    <v-alert v-if="error" type="error" :text="errorText(error)" />
    <v-skeleton-loader v-else-if="isPending" type="list-item@4" />
    <EmptyState
      v-else-if="!tags?.length"
      :icon="mdiTagMultipleOutline"
      :title="t('tags.empty.title')"
      :text="t('tags.empty.text')"
    >
      <v-btn color="primary" :prepend-icon="mdiPlus" @click="openNew">{{ t('tags.add') }}</v-btn>
    </EmptyState>

    <v-card v-else>
      <v-list lines="one">
        <v-list-item
          v-for="tag in tags"
          :key="tag.id"
          :subtitle="usage(tag)"
          link
          :to="{ path: '/recipes', query: { tag: tag.id } }"
        >
          <template #title>
            <v-chip :color="tag.color ?? 'secondary'" variant="tonal" size="small">#{{ tag.name }}</v-chip>
          </template>
          <template #append>
            <v-btn
              :icon="mdiPencilOutline"
              variant="text"
              size="small"
              :aria-label="t('tags.editAria', { name: tag.name })"
              @click.prevent="openEdit(tag)"
            />
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <v-dialog v-model="dialogOpen" max-width="420">
      <v-card :title="editing ? t('tags.editTitle') : t('tags.new')">
        <v-card-text class="d-flex flex-column ga-4">
          <v-text-field
            v-model="name"
            autocomplete="off"
            :label="t('tags.name')"
            autofocus
            hide-details="auto"
            @keydown.enter="onSave"
          />
          <div>
            <div class="text-caption text-medium-emphasis mb-1">{{ t('tags.color') }}</div>
            <v-chip-group v-model="color" column selected-class="elevation-6">
              <v-chip
                v-for="c in MEMBER_COLORS"
                :key="c"
                :value="c"
                :color="c"
                :base-color="c"
                variant="flat"
                size="large"
                :aria-label="t('tags.colorAria', { color: c })"
                class="px-3"
              >
                <v-icon :icon="mdiCheck" :style="{ visibility: color === c ? 'visible' : 'hidden' }" />
              </v-chip>
            </v-chip-group>
          </div>
          <v-alert v-if="formError" type="error" density="compact" :text="formError" />
        </v-card-text>
        <v-card-actions class="flex-wrap ga-1">
          <template v-if="editing">
            <v-btn v-if="!confirmDelete" color="error" variant="text" @click="confirmDelete = true">{{
              t('common.actions.delete')
            }}</v-btn>
            <v-btn v-else color="error" :loading="remove.isPending.value" @click="onDelete">{{
              t('tags.reallyDelete')
            }}</v-btn>
          </template>
          <v-spacer />
          <v-btn variant="text" @click="dialogOpen = false">{{ t('common.actions.cancel') }}</v-btn>
          <v-btn color="primary" :loading="save.isPending.value" @click="onSave">{{
            t('common.actions.save')
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </ListLayout>
</template>
