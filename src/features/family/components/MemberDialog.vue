<script setup lang="ts">
import { mdiCheck } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FamilyMemberDto } from '@shared/api'
import { MEMBER_COLORS, type MemberKind } from '@shared/family'
import { useIngredients, useTags } from '@/api/catalog'
import { useDeleteMember, useSaveMember, useSaveMemberPreferences } from '@/api/family'
import { errorText } from '@/i18n/errors'
import { formatNumber } from '@/i18n/format'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
const props = defineProps<{ member: FamilyMemberDto | null; childFactor: number; nextColor: string }>()

const name = ref('')
const kind = ref<MemberKind>('adult')
const factor = ref(1)
const color = ref<string>(MEMBER_COLORS[0])
const isActive = ref(true)
const error = ref('')
const confirmDelete = ref(false)

const allergies = ref<string[]>([])
const dislikes = ref<string[]>([])
const diets = ref<string[]>([])

const save = useSaveMember()
const savePreferences = useSaveMemberPreferences()
const remove = useDeleteMember()
const saving = computed(() => save.isPending.value || savePreferences.isPending.value)

const { data: ingredients } = useIngredients()
const { data: tags } = useTags()
const ingredientItems = computed(() => ingredients.value?.map((i) => ({ title: i.name, value: i.id })) ?? [])
const tagItems = computed(() => tags.value?.map((tag) => ({ title: tag.name, value: tag.id })) ?? [])

const idsOf = (member: FamilyMemberDto | null, kind: 'allergy' | 'dislike' | 'diet') =>
  (member?.preferences ?? [])
    .filter((p) => p.kind === kind)
    .map((p) => (kind === 'diet' ? p.tagId : p.ingredientId))
    .filter((id): id is string => id !== null)

watch(open, (isOpen) => {
  if (!isOpen) return
  const m = props.member
  name.value = m?.name ?? ''
  kind.value = m?.kind ?? 'adult'
  factor.value = m?.portionFactor ?? 1
  color.value = m?.color ?? props.nextColor
  isActive.value = m?.isActive ?? true
  allergies.value = idsOf(m, 'allergy')
  dislikes.value = idsOf(m, 'dislike')
  diets.value = idsOf(m, 'diet')
  error.value = ''
  confirmDelete.value = false
})

function onKindChange(value: MemberKind) {
  kind.value = value
  if (!props.member) factor.value = value === 'child' ? props.childFactor : 1
}

async function onSave() {
  if (!name.value.trim()) {
    error.value = t('family.member.nameRequired')
    return
  }
  try {
    const saved = await save.mutateAsync({
      id: props.member?.id,
      input: {
        name: name.value,
        kind: kind.value,
        portionFactor: factor.value,
        color: color.value,
        isActive: isActive.value,
      },
    })
    await savePreferences.mutateAsync({
      id: saved.id,
      allergies: allergies.value,
      dislikes: dislikes.value,
      diets: diets.value,
    })
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'family.member.saveFailed')
  }
}

async function onDelete() {
  if (!props.member) return
  try {
    await remove.mutateAsync(props.member.id)
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'family.member.deleteFailed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="460">
    <v-card :title="member ? t('family.member.editTitle') : t('family.member.newTitle')">
      <v-card-text class="d-flex flex-column ga-4">
        <v-text-field
          v-model="name"
          autocomplete="off"
          :label="t('family.member.name')"
          autofocus
          hide-details="auto"
          @keydown.enter="onSave"
        />

        <div>
          <div class="text-body-small text-medium-emphasis mb-1">{{ t('family.member.who') }}</div>
          <v-btn-toggle
            :model-value="kind"
            mandatory
            selected-class="bg-primary"
            variant="outlined"
            divided
            :aria-label="t('family.member.whoAria')"
            @update:model-value="onKindChange"
          >
            <v-btn value="adult">{{ t('common.memberKind.adult') }}</v-btn>
            <v-btn value="child">{{ t('common.memberKind.child') }}</v-btn>
            <v-btn value="guest" data-test="kind-guest">{{ t('common.memberKind.guest') }}</v-btn>
          </v-btn-toggle>
        </div>

        <div>
          <div class="d-flex align-baseline justify-space-between">
            <span class="text-body-small text-medium-emphasis">{{ t('family.member.portionSize') }}</span>
            <span class="text-body-medium font-weight-bold">{{
              t('family.member.factorTimesAdult', { factor: formatNumber(factor) })
            }}</span>
          </div>
          <v-slider v-model="factor" :min="0.25" :max="1.5" :step="0.05" color="primary" hide-details />
          <p class="text-body-small text-medium-emphasis">
            {{ t('family.member.portionHint') }}
          </p>
        </div>

        <div>
          <div class="text-body-small text-medium-emphasis mb-1">{{ t('family.member.color') }}</div>
          <v-chip-group v-model="color" mandatory column selected-class="elevation-6">
            <v-chip
              v-for="c in MEMBER_COLORS"
              :key="c"
              :value="c"
              :color="c"
              :base-color="c"
              variant="flat"
              size="large"
              :aria-label="t('family.member.colorAria', { color: c })"
              class="px-3"
            >
              <v-icon :icon="mdiCheck" :style="{ visibility: color === c ? 'visible' : 'hidden' }" />
            </v-chip>
          </v-chip-group>
        </div>

        <div>
          <div class="text-body-small text-medium-emphasis mb-1">{{ t('family.member.foodHealth') }}</div>
          <div class="d-flex flex-column ga-3">
            <v-autocomplete
              v-model="allergies"
              :items="ingredientItems"
              :label="t('family.member.allergies')"
              :hint="t('family.member.allergiesHint')"
              persistent-hint
              multiple
              chips
              closable-chips
              :no-data-text="t('family.member.noIngredient')"
            />
            <v-autocomplete
              v-model="dislikes"
              :items="ingredientItems"
              :label="t('family.member.dislikes')"
              :hint="t('family.member.dislikesHint')"
              persistent-hint
              multiple
              chips
              closable-chips
              :no-data-text="t('family.member.noIngredient')"
            />
            <v-autocomplete
              v-model="diets"
              :items="tagItems"
              :label="t('family.member.diets')"
              :hint="t('family.member.dietsHint')"
              persistent-hint
              multiple
              chips
              closable-chips
              :no-data-text="t('family.member.noTag')"
            />
          </div>
        </div>

        <v-switch
          v-model="isActive"
          color="primary"
          :label="t('family.member.countInPortions')"
          :hint="t('family.member.countInPortionsHint')"
          persistent-hint
        />

        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="flex-wrap ga-1">
        <template v-if="member">
          <v-btn v-if="!confirmDelete" color="error" variant="text" @click="confirmDelete = true">{{
            t('common.actions.delete')
          }}</v-btn>
          <v-btn v-else color="error" :loading="remove.isPending.value" @click="onDelete">{{
            t('family.member.reallyDelete')
          }}</v-btn>
        </template>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn color="primary" :loading="saving" @click="onSave">{{ t('common.actions.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
