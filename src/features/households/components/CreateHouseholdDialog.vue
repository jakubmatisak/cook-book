<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCreateHousehold } from '@/api/households'
import { setActiveHousehold } from '@/lib/household'

const open = defineModel<boolean>({ required: true })

const name = ref('')
const error = ref('')
const create = useCreateHousehold()

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = ''
  error.value = ''
})

async function onCreate() {
  const value = name.value.trim()
  if (!value) return void (error.value = 'Zadaj názov domácnosti.')
  try {
    const created = await create.mutateAsync(value)
    open.value = false
    // Novú domácnosť rovno otvoríme; načítanie odznova vyčistí dáta predošlej.
    setActiveHousehold(created.id)
    window.location.assign('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Domácnosť sa nepodarilo založiť.'
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card title="Nová domácnosť">
      <v-card-text class="d-flex flex-column ga-3">
        <p class="text-body-2 text-medium-emphasis">
          Nová domácnosť má vlastné recepty, jedálniček, nákupný zoznam a špajzu. Budeš jej vlastníkom.
        </p>
        <v-text-field
          v-model="name"
          autocomplete="off"
          label="Názov domácnosti"
          placeholder="napr. U rodičov"
          maxlength="60"
          autofocus
          hide-details="auto"
          :error-messages="error"
          data-test="household-name"
          @keydown.enter="onCreate"
        />
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="open = false">Zrušiť</v-btn>
        <v-btn
          color="primary"
          :loading="create.isPending.value"
          data-test="household-create"
          @click="onCreate"
        >
          Založiť
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
