<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IngredientDto } from '@shared/api'
import { mixedUnits } from '@shared/ingredientDuplicates'
import { useMergeIngredients } from '@/api/bulk'
import { useIngredientUnits } from '@/api/ingredientMerge'
import { errorText } from '@/i18n/errors'
import { tc } from '@/i18n/format'

/**
 * Zlúčenie vybraných ingrediencií do jednej (napr. „Banány“ do „Banán“). Predvolene ostane najpoužívanejšia;
 * dá sa vybrať iná a rovno ju premenovať. Server prepíše recepty, nákup, špajzu aj stále položky.
 */
const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
const props = defineProps<{ items: IngredientDto[] }>()
const emit = defineEmits<{ merged: [ingredient: IngredientDto] }>()
const merge = useMergeIngredients()

const targetId = ref<string | null>(null)
const name = ref('')
const error = ref('')

const target = computed(() => props.items.find((i) => i.id === targetId.value))

// Jednotky, ktoré sa nedajú prepočítať (napr. g a ks): recepty si množstvá nechajú, ale v nákupe sa nesčítajú.
const { data: units } = useIngredientUnits(
  () => props.items.map((i) => i.id),
  () => open.value,
)
const mixed = computed(() =>
  units.value ? mixedUnits(props.items.map((i) => [...(units.value?.[i.id] ?? []), i.defaultUnit])) : [],
)
const unitsConfirmed = ref(false)
const sources = computed(() => props.items.filter((i) => i.id !== targetId.value))

watch(open, (value) => {
  if (!value) return
  const mostUsed = [...props.items].sort((a, b) => b.usageCount - a.usageCount)[0]
  targetId.value = mostUsed?.id ?? null
  name.value = mostUsed?.name ?? ''
  error.value = ''
  unitsConfirmed.value = false
})
// Pri zmene ponechanej ingrediencie sa názov nastaví na jej názov (dá sa prepísať).
watch(targetId, () => {
  if (target.value) name.value = target.value.name
})

async function submit() {
  if (!target.value || !name.value.trim()) return
  error.value = ''
  try {
    const trimmed = name.value.trim()
    const merged = await merge.mutateAsync({
      targetId: target.value.id,
      sourceIds: sources.value.map((s) => s.id),
      ...(trimmed !== target.value.name ? { name: trimmed } : {}),
    })
    open.value = false
    emit('merged', merged)
  } catch (e) {
    error.value = errorText(e, 'ingredients.merge.failed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card :title="t('ingredients.merge.title')" data-test="merge-dialog">
      <v-card-text class="d-flex flex-column ga-3">
        <div class="font-weight-bold">{{ t('ingredients.merge.keep') }}</div>
        <v-radio-group v-model="targetId" hide-details>
          <v-radio
            v-for="item in items"
            :key="item.id"
            :value="item.id"
            :label="`${item.name} · ${item.usageCount ? tc('ingredients.usedIn', item.usageCount) : t('ingredients.page.unused')}`"
            :data-test="`merge-target-${item.id}`"
          />
        </v-radio-group>
        <v-text-field
          v-model="name"
          :label="t('ingredients.merge.name')"
          hide-details="auto"
          data-test="merge-name"
        />
        <p v-if="target">
          {{
            t('ingredients.merge.summary', {
              sources: sources.map((s) => s.name).join(', '),
              target: name.trim() || target.name,
            })
          }}
        </p>
        <p class="text-medium-emphasis">{{ t('ingredients.merge.aliasHint') }}</p>
        <v-alert
          v-if="mixed.length"
          type="warning"
          density="compact"
          :text="t('ingredients.merge.unitsWarning', { units: mixed.join(', ') })"
          data-test="merge-units-warning"
        />
        <v-checkbox
          v-if="mixed.length"
          v-model="unitsConfirmed"
          :label="t('ingredients.merge.unitsConfirm')"
          color="primary"
          hide-details
          data-test="merge-units-confirm"
        />
        <v-alert v-if="error" type="error" :text="error" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn
          color="primary"
          :disabled="!target || !name.trim() || (mixed.length > 0 && !unitsConfirmed)"
          :loading="merge.isPending.value"
          data-test="merge-confirm"
          @click="submit"
        >
          {{ t('ingredients.merge.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
