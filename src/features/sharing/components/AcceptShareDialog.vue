<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IncomingShareDto } from '@shared/api'
import { useAcceptShare } from '@/api/sharing'
import { errorText } from '@/i18n/errors'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ share: IncomingShareDto }>()
const emit = defineEmits<{ done: [message: string] }>()

const { t } = useI18n()
const accept = useAcceptShare()
const selected = ref<string[]>([])
const error = ref('')

watch(
  open,
  (value) => {
    if (!value) return
    selected.value = props.share.recipes.map((r) => r.id)
    error.value = ''
  },
  { immediate: true },
)

const allSelected = computed(() => selected.value.length === props.share.recipes.length)

function toggleAll() {
  selected.value = allSelected.value ? [] : props.share.recipes.map((r) => r.id)
}

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((s) => s !== id)
    : [...selected.value, id]
}

async function confirm() {
  try {
    await accept.mutateAsync({ id: props.share.id, recipeIds: selected.value })
    open.value = false
    emit('done', t('sharing.done.accepted'))
  } catch (e) {
    error.value = errorText(e)
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="480" scrollable>
    <v-card :title="t('sharing.accept.title')" data-test="accept-dialog">
      <v-card-text class="pa-0">
        <v-list density="compact">
          <v-list-item :title="t('sharing.accept.all')" data-test="accept-all" @click="toggleAll">
            <template #prepend>
              <v-checkbox-btn
                :model-value="allSelected"
                :indeterminate="!allSelected && selected.length > 0"
                color="primary"
                tabindex="-1"
              />
            </template>
          </v-list-item>
          <v-divider />
          <v-list-item
            v-for="recipe in share.recipes"
            :key="recipe.id"
            :title="recipe.title"
            :data-test="`accept-recipe-${recipe.id}`"
            @click="toggle(recipe.id)"
          >
            <template #prepend>
              <v-checkbox-btn
                :model-value="selected.includes(recipe.id)"
                color="primary"
                tabindex="-1"
                @click.stop="toggle(recipe.id)"
              />
            </template>
          </v-list-item>
        </v-list>
        <v-alert v-if="error" type="error" density="compact" class="ma-4" :text="error" />
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="selected.length === 0"
          :loading="accept.isPending.value"
          data-test="accept-confirm"
          @click="confirm"
        >
          {{ t('sharing.accept.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
