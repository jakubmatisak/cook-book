<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDeleteIngredient, useUpdateIngredient } from '@/api/catalog'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ ingredient: { id: string; name: string } | null }>()

const name = ref('')
const error = ref('')
const confirmDelete = ref(false)

const update = useUpdateIngredient()
const remove = useDeleteIngredient()

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = props.ingredient?.name ?? ''
  error.value = ''
  confirmDelete.value = false
})

async function onSave() {
  if (!props.ingredient) return
  const value = name.value.trim()
  if (!value) return void (error.value = 'Zadaj názov.')
  if (value === props.ingredient.name) {
    open.value = false
    return
  }
  try {
    await update.mutateAsync({ id: props.ingredient.id, patch: { name: value } })
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Premenovanie zlyhalo.'
  }
}

async function onDelete() {
  if (!props.ingredient) return
  try {
    await remove.mutateAsync(props.ingredient.id)
    open.value = false
  } catch (e) {
    // Napr. ingrediencia sa používa v receptoch: server povie, v koľkých.
    error.value = e instanceof Error ? e.message : 'Zmazanie zlyhalo.'
    confirmDelete.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card title="Upraviť ingredienciu">
      <v-card-text class="d-flex flex-column ga-3">
        <v-text-field
          v-model="name"
          autocomplete="off"
          label="Názov"
          hide-details="auto"
          autofocus
          @keydown.enter="onSave"
        />
        <p class="text-body-2 text-medium-emphasis">
          Premenovanie sa prejaví vo všetkých receptoch, v špajzi aj v nákupnom zozname.
        </p>
        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-btn v-if="!confirmDelete" color="error" variant="text" @click="confirmDelete = true">Zmazať</v-btn>
        <v-btn v-else color="error" :loading="remove.isPending.value" @click="onDelete">Naozaj zmazať</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Zrušiť</v-btn>
        <v-btn color="primary" :loading="update.isPending.value" @click="onSave">Uložiť</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
