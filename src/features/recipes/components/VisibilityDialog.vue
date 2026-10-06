<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RecipeVisibility } from '@shared/recipes'
import { useSetRecipeVisibility } from '@/api/publicRecipes'
import { errorText } from '@/i18n/errors'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ recipeId: string; visibility: RecipeVisibility }>()
const emit = defineEmits<{ done: [message: string]; failed: [message: string] }>()

const { t } = useI18n()
const set = useSetRecipeVisibility()
const publishing = computed(() => props.visibility === 'private')

async function confirm() {
  const next: RecipeVisibility = publishing.value ? 'public' : 'private'
  try {
    await set.mutateAsync({ id: props.recipeId, visibility: next })
    open.value = false
    emit(
      'done',
      t(next === 'public' ? 'publicRecipes.visibility.published' : 'publicRecipes.visibility.hidden'),
    )
  } catch (e) {
    open.value = false
    emit('failed', errorText(e))
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="460">
    <v-card
      :title="
        publishing ? t('publicRecipes.visibility.publishTitle') : t('publicRecipes.visibility.hideTitle')
      "
    >
      <v-card-text>
        {{ publishing ? t('publicRecipes.visibility.publishText') : t('publicRecipes.visibility.hideText') }}
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn color="primary" :loading="set.isPending.value" data-test="visibility-confirm" @click="confirm">
          {{ publishing ? t('publicRecipes.visibility.publish') : t('publicRecipes.visibility.hide') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
