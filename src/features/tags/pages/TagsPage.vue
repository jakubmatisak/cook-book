<script setup lang="ts">
import { mdiCheck, mdiPencilOutline, mdiPlus, mdiTagMultipleOutline } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import type { TagDto } from '@shared/api'
import { MEMBER_COLORS } from '@shared/family'
import { useDeleteTag, useSaveTag, useTags } from '@/api/catalog'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { plural } from '@/lib/format'

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
  if (!name.value.trim()) return void (formError.value = 'Zadaj názov tagu.')
  try {
    await save.mutateAsync({ id: editing.value?.id, input: { name: name.value, color: color.value } })
    dialogOpen.value = false
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Uloženie zlyhalo.'
  }
}

async function onDelete() {
  if (!editing.value) return
  try {
    await remove.mutateAsync(editing.value.id)
    dialogOpen.value = false
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Zmazanie zlyhalo.'
  }
}

const subtitle = computed(() =>
  tags.value?.length ? plural(tags.value.length, 'tag', 'tagy', 'tagov') : undefined,
)
const usage = (tag: TagDto) =>
  tag.recipeCount ? plural(tag.recipeCount, 'recept', 'recepty', 'receptov') : 'nepoužitý'
</script>

<template>
  <PageHeader title="Tagy" :subtitle="subtitle">
    <v-btn color="primary" :prepend-icon="mdiPlus" @click="openNew">Nový tag</v-btn>
  </PageHeader>

  <v-alert v-if="error" type="error" :text="error.message" />
  <v-skeleton-loader v-else-if="isPending" type="list-item@4" />
  <EmptyState
    v-else-if="!tags?.length"
    :icon="mdiTagMultipleOutline"
    title="Zatiaľ žiadne tagy"
    text="Tagy pomáhajú triediť recepty: rýchle, detské, na víkend… Pridávajú sa aj priamo v recepte."
  >
    <v-btn color="primary" :prepend-icon="mdiPlus" @click="openNew">Pridať tag</v-btn>
  </EmptyState>

  <v-card v-else>
    <v-list lines="one">
      <v-list-item
        v-for="tag in tags"
        :key="tag.id"
        :subtitle="usage(tag)"
        link
        :to="{ path: '/recepty', query: { tag: tag.id } }"
      >
        <template #title>
          <v-chip :color="tag.color ?? 'secondary'" variant="tonal" size="small">#{{ tag.name }}</v-chip>
        </template>
        <template #append>
          <v-btn
            :icon="mdiPencilOutline"
            variant="text"
            size="small"
            :aria-label="`Upraviť ${tag.name}`"
            @click.prevent="openEdit(tag)"
          />
        </template>
      </v-list-item>
    </v-list>
  </v-card>

  <v-dialog v-model="dialogOpen" max-width="420">
    <v-card :title="editing ? 'Upraviť tag' : 'Nový tag'">
      <v-card-text class="d-flex flex-column ga-4">
        <v-text-field
          v-model="name"
          autocomplete="off"
          label="Názov"
          autofocus
          hide-details="auto"
          @keydown.enter="onSave"
        />
        <div>
          <div class="text-caption text-medium-emphasis mb-1">Farba (voliteľná)</div>
          <v-chip-group v-model="color" column selected-class="elevation-6">
            <v-chip
              v-for="c in MEMBER_COLORS"
              :key="c"
              :value="c"
              :color="c"
              :base-color="c"
              variant="flat"
              size="large"
              :aria-label="`Farba ${c}`"
              class="px-3"
            >
              <v-icon :icon="mdiCheck" :style="{ visibility: color === c ? 'visible' : 'hidden' }" />
            </v-chip>
          </v-chip-group>
        </div>
        <v-alert v-if="formError" type="error" density="compact" :text="formError" />
      </v-card-text>
      <v-card-actions>
        <template v-if="editing">
          <v-btn v-if="!confirmDelete" color="error" variant="text" @click="confirmDelete = true"
            >Zmazať</v-btn
          >
          <v-btn v-else color="error" :loading="remove.isPending.value" @click="onDelete"
            >Naozaj zmazať</v-btn
          >
        </template>
        <v-spacer />
        <v-btn variant="text" @click="dialogOpen = false">Zrušiť</v-btn>
        <v-btn color="primary" :loading="save.isPending.value" @click="onSave">Uložiť</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
