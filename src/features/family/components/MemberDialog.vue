<script setup lang="ts">
import { mdiCheck } from '@mdi/js'
import { ref, watch } from 'vue'
import type { FamilyMemberDto } from '@shared/api'
import { MEMBER_COLORS, MEMBER_KIND_LABELS, type MemberKind } from '@shared/family'
import { useDeleteMember, useSaveMember } from '@/api/family'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ member: FamilyMemberDto | null; childFactor: number; nextColor: string }>()

const name = ref('')
const kind = ref<MemberKind>('adult')
const factor = ref(1)
const color = ref<string>(MEMBER_COLORS[0])
const isActive = ref(true)
const error = ref('')
const confirmDelete = ref(false)

const save = useSaveMember()
const remove = useDeleteMember()

watch(open, (isOpen) => {
  if (!isOpen) return
  const m = props.member
  name.value = m?.name ?? ''
  kind.value = m?.kind ?? 'adult'
  factor.value = m?.portionFactor ?? 1
  color.value = m?.color ?? props.nextColor
  isActive.value = m?.isActive ?? true
  error.value = ''
  confirmDelete.value = false
})

function onKindChange(value: MemberKind) {
  kind.value = value
  if (!props.member) factor.value = value === 'child' ? props.childFactor : 1
}

const formatFactor = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

async function onSave() {
  if (!name.value.trim()) {
    error.value = 'Zadaj meno.'
    return
  }
  try {
    await save.mutateAsync({
      id: props.member?.id,
      input: {
        name: name.value,
        kind: kind.value,
        portionFactor: factor.value,
        color: color.value,
        isActive: isActive.value,
      },
    })
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Uloženie zlyhalo.'
  }
}

async function onDelete() {
  if (!props.member) return
  try {
    await remove.mutateAsync(props.member.id)
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Zmazanie zlyhalo.'
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="460">
    <v-card :title="member ? 'Upraviť člena rodiny' : 'Nový člen rodiny'">
      <v-card-text class="d-flex flex-column ga-4">
        <v-text-field v-model="name" label="Meno" autofocus hide-details="auto" @keydown.enter="onSave" />

        <div>
          <div class="text-caption text-medium-emphasis mb-1">Kto to je</div>
          <v-btn-toggle
            :model-value="kind"
            mandatory
            color="primary"
            variant="outlined"
            divided
            aria-label="Dospelý alebo dieťa"
            @update:model-value="onKindChange"
          >
            <v-btn value="adult">{{ MEMBER_KIND_LABELS.adult }}</v-btn>
            <v-btn value="child">{{ MEMBER_KIND_LABELS.child }}</v-btn>
          </v-btn-toggle>
        </div>

        <div>
          <div class="d-flex align-baseline justify-space-between">
            <span class="text-caption text-medium-emphasis">Veľkosť porcie</span>
            <span class="text-body-2 font-weight-bold">{{ formatFactor(factor) }} × dospelý</span>
          </div>
          <v-slider v-model="factor" :min="0.25" :max="1.5" :step="0.05" color="primary" hide-details />
          <p class="text-caption text-medium-emphasis">
            Podľa toho sa prepočíta množstvo pri nákupe. Malé dieťa býva 0,3 – 0,5, tínedžer okolo 1.
          </p>
        </div>

        <div>
          <div class="text-caption text-medium-emphasis mb-1">Farba</div>
          <v-chip-group v-model="color" mandatory column>
            <v-chip
              v-for="c in MEMBER_COLORS"
              :key="c"
              :value="c"
              :color="c"
              variant="flat"
              size="large"
              :aria-label="`Farba ${c}`"
              class="px-3"
            >
              <v-icon :icon="mdiCheck" :style="{ visibility: color === c ? 'visible' : 'hidden' }" />
            </v-chip>
          </v-chip-group>
        </div>

        <v-switch
          v-model="isActive"
          color="primary"
          label="Počítať do porcií"
          hint="Vypni, keď niekto dlhšie nie je doma."
          persistent-hint
        />

        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions>
        <template v-if="member">
          <v-btn v-if="!confirmDelete" color="error" variant="text" @click="confirmDelete = true"
            >Zmazať</v-btn
          >
          <v-btn v-else color="error" :loading="remove.isPending.value" @click="onDelete"
            >Naozaj zmazať</v-btn
          >
        </template>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Zrušiť</v-btn>
        <v-btn color="primary" :loading="save.isPending.value" @click="onSave">Uložiť</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
