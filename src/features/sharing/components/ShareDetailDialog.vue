<script setup lang="ts">
import { mdiMagnify } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IncomingShareDto, OutgoingShareDto } from '@shared/api'
import { normalizeText } from '@shared/text'
import { useRemoveShareItems, useRevokeShare } from '@/api/sharing'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { errorText } from '@/i18n/errors'
import { formatDate } from '@/i18n/format'
import { shareWhat, STATUS_COLORS } from '../labels'

/**
 * Detail jedného zdieľania: recepty s hľadaním. Pri vlastnom zdieľaní vybraných receptov sa dajú recepty
 * hromadne odobrať a zdieľanie zrušiť; pri prijatom sa recepty len otvárajú na čítanie.
 */
const open = defineModel<boolean>({ required: true })
const props = defineProps<{
  share: OutgoingShareDto | IncomingShareDto
  /** Moje zdieľanie (karta Zdieľam) – dá sa upravovať. */
  outgoing: boolean
  title: string
}>()
const emit = defineEmits<{ done: [message: string, color?: string] }>()

const { t } = useI18n()
const removeItems = useRemoveShareItems()
const revoke = useRevokeShare()

const search = ref('')
const selected = ref<string[]>([])
const confirmRevoke = ref(false)
watch(open, (value) => {
  if (!value) return
  search.value = ''
  selected.value = []
})

const active = computed(() => props.share.status === 'pending' || props.share.status === 'accepted')
/** Odoberať sa dá len z vlastného zdieľania vybraných receptov (kategória či tag sa zdieľa celý). */
const editable = computed(() => props.outgoing && active.value && props.share.kind === 'recipes')
const filtered = computed(() => {
  const needle = normalizeText(search.value ?? '')
  return needle
    ? props.share.recipes.filter((r) => normalizeText(r.title).includes(needle))
    : props.share.recipes
})
const allFiltered = computed(
  () => filtered.value.length > 0 && filtered.value.every((r) => selected.value.includes(r.id)),
)

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((s) => s !== id)
    : [...selected.value, id]
}
function toggleAll() {
  const ids = filtered.value.map((r) => r.id)
  selected.value = allFiltered.value
    ? selected.value.filter((id) => !ids.includes(id))
    : [...new Set([...selected.value, ...ids])]
}

async function removeSelected() {
  try {
    await removeItems.mutateAsync({ id: props.share.id, recipeIds: selected.value })
    selected.value = []
    emit('done', t('sharing.done.removed'))
  } catch (e) {
    emit('done', errorText(e), 'error')
  }
}

async function doRevoke() {
  try {
    await revoke.mutateAsync({ id: props.share.id })
    confirmRevoke.value = false
    open.value = false
    emit('done', t('sharing.done.revoked'))
  } catch (e) {
    confirmRevoke.value = false
    emit('done', errorText(e), 'error')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560" scrollable>
    <v-card :title="title" data-test="share-detail">
      <template #subtitle>
        <span class="text-wrap">{{ shareWhat(share) }} · {{ formatDate(share.createdAt) }}</span>
      </template>
      <template #append>
        <v-chip :color="STATUS_COLORS[share.status]" variant="tonal" size="small">
          {{ t(`sharing.status.${share.status}`) }}
        </v-chip>
      </template>
      <v-card-text class="d-flex flex-column ga-3">
        <div v-if="share.message" class="text-body-medium">„{{ share.message }}“</div>
        <v-text-field
          v-if="share.recipes.length > 5"
          v-model="search"
          :label="t('sharing.detail.search')"
          :prepend-inner-icon="mdiMagnify"
          clearable
          hide-details
          data-test="share-search"
        />
        <v-list density="compact" class="pa-0" bg-color="transparent">
          <v-list-item
            v-if="editable && filtered.length > 1"
            :title="t('sharing.detail.selectAll', { n: filtered.length })"
            @click="toggleAll"
          >
            <template #prepend>
              <v-checkbox-btn
                :model-value="allFiltered"
                :indeterminate="!allFiltered && filtered.some((r) => selected.includes(r.id))"
                color="primary"
                tabindex="-1"
              />
            </template>
          </v-list-item>
          <template v-for="recipe in filtered" :key="recipe.id">
            <v-list-item
              v-if="editable"
              :title="recipe.title"
              :data-test="`share-item-${recipe.id}`"
              @click="toggle(recipe.id)"
            >
              <template #prepend>
                <v-checkbox-btn :model-value="selected.includes(recipe.id)" color="primary" tabindex="-1" />
              </template>
            </v-list-item>
            <v-list-item
              v-else
              :title="recipe.title"
              :to="outgoing ? `/recipes/${recipe.id}` : `/public/${recipe.id}`"
            />
          </template>
          <v-list-item v-if="!filtered.length" :title="t('sharing.detail.noMatch')" disabled />
        </v-list>
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-btn
          v-if="outgoing && active"
          color="error"
          variant="text"
          data-test="share-revoke"
          @click="confirmRevoke = true"
        >
          {{ t('sharing.actions.revoke') }}
        </v-btn>
        <v-spacer />
        <v-btn
          v-if="editable"
          color="primary"
          :disabled="!selected.length"
          :loading="removeItems.isPending.value"
          data-test="share-remove-selected"
          @click="removeSelected"
        >
          {{ t('sharing.detail.removeSelected', { n: selected.length }) }}
        </v-btn>
        <v-btn variant="text" @click="open = false">{{ t('common.actions.close') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <ConfirmDialog
    v-model="confirmRevoke"
    :title="t('sharing.actions.revoke')"
    :text="t('sharing.detail.revokeText')"
    :confirm-label="t('sharing.actions.revoke')"
    :loading="revoke.isPending.value"
    @confirm="doRevoke"
  />
</template>
