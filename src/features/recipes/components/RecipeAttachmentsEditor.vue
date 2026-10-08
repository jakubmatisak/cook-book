<script setup lang="ts">
import { mdiArrowLeft, mdiArrowRight, mdiClose, mdiImagePlusOutline } from '@mdi/js'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RecipeAttachmentDto } from '@shared/api'
import { uploadImage } from '@/api/recipes'
import { errorText } from '@/i18n/errors'
import { resizeImage } from '@/lib/image'

const { t } = useI18n()
const attachments = defineModel<RecipeAttachmentDto[]>({ required: true })

const input = ref<HTMLInputElement>()
const uploading = ref(0)
const error = ref('')

// Fotky sa zmenšia (najviac 1600 px) a nahrajú postupne, v poradí výberu; nepodarená fotka ostatné nezastaví.
async function onFiles(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  if (!files.length) return
  error.value = ''
  uploading.value = files.length
  try {
    for (const file of files) {
      try {
        const resized = await resizeImage(file)
        const image = await uploadImage(resized.blob, resized.width, resized.height)
        attachments.value = [
          ...attachments.value,
          { id: image.id, url: image.url, width: resized.width, height: resized.height },
        ]
      } catch (e) {
        error.value = errorText(e, 'recipes.attachments.uploadFailed')
      } finally {
        uploading.value--
      }
    }
  } finally {
    uploading.value = 0
    if (input.value) input.value.value = ''
  }
}

function remove(index: number) {
  attachments.value = attachments.value.filter((_, i) => i !== index)
}

function move(index: number, by: -1 | 1) {
  const next = [...attachments.value]
  const [item] = next.splice(index, 1)
  next.splice(index + by, 0, item!)
  attachments.value = next
}
</script>

<template>
  <div>
    <input
      ref="input"
      type="file"
      accept="image/*"
      multiple
      class="d-none"
      data-test="attachments-input"
      @change="onFiles"
    />
    <div class="d-flex flex-wrap ga-2">
      <v-card
        v-for="(item, index) in attachments"
        :key="item.id"
        width="104"
        variant="outlined"
        data-test="attachment-item"
      >
        <v-img :src="item.url" :aspect-ratio="3 / 4" cover />
        <v-card-actions class="pa-0 justify-space-between">
          <v-btn
            :icon="mdiArrowLeft"
            size="x-small"
            variant="text"
            :disabled="index === 0"
            :aria-label="t('recipes.attachments.moveUp')"
            data-test="attachment-move-up"
            @click="move(index, -1)"
          />
          <v-btn
            :icon="mdiClose"
            size="x-small"
            variant="text"
            color="error"
            :aria-label="t('recipes.attachments.remove')"
            data-test="attachment-remove"
            @click="remove(index)"
          />
          <v-btn
            :icon="mdiArrowRight"
            size="x-small"
            variant="text"
            :disabled="index === attachments.length - 1"
            :aria-label="t('recipes.attachments.moveDown')"
            data-test="attachment-move-down"
            @click="move(index, 1)"
          />
        </v-card-actions>
      </v-card>
      <v-card
        width="104"
        min-height="139"
        variant="outlined"
        class="position-relative"
        :aria-label="t('recipes.attachments.add')"
        data-test="attachments-add"
        @click="input?.click()"
      >
        <div class="d-flex flex-column align-center justify-center h-100 pa-2 text-primary text-center">
          <v-icon :icon="mdiImagePlusOutline" size="32" />
          <span class="text-body-small">{{ t('recipes.attachments.add') }}</span>
        </div>
        <v-overlay :model-value="uploading > 0" contained persistent class="align-center justify-center">
          <v-progress-circular indeterminate color="primary" />
        </v-overlay>
      </v-card>
    </div>
    <v-alert v-if="error" type="error" density="compact" :text="error" class="mt-2" />
  </div>
</template>
