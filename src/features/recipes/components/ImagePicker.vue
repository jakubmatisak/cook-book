<script setup lang="ts">
import { mdiCameraOutline, mdiClose } from '@mdi/js'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { uploadImage } from '@/api/recipes'
import { errorText } from '@/i18n/errors'
import { resizeImage } from '@/lib/image'

const { t } = useI18n()
const imageId = defineModel<string | null>('imageId', { required: true })
const imageUrl = defineModel<string | null>('imageUrl', { required: true })

const input = ref<HTMLInputElement>()
const uploading = ref(false)
const error = ref('')

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  error.value = ''
  uploading.value = true
  try {
    const resized = await resizeImage(file)
    const image = await uploadImage(resized.blob, resized.width, resized.height)
    imageId.value = image.id
    imageUrl.value = image.url
  } catch (e) {
    error.value = errorText(e, 'recipes.image.uploadFailed')
  } finally {
    uploading.value = false
    if (input.value) input.value.value = ''
  }
}

function clear() {
  imageId.value = null
  imageUrl.value = null
}
</script>

<template>
  <!-- Malá dlaždica: klik vyberie alebo zmení fotku, krížik ju odstráni. Vstup je mimo karty, aby jeho klik nespúšťal kartu znova. -->
  <div>
    <input ref="input" type="file" accept="image/*" class="d-none" data-test="image-input" @change="onFile" />
    <v-card
      width="104"
      height="104"
      variant="outlined"
      class="position-relative"
      :aria-label="imageUrl ? t('recipes.image.change') : t('recipes.image.add')"
      @click="input?.click()"
    >
      <v-img v-if="imageUrl" :src="imageUrl" cover height="104" />
      <div v-else class="d-flex flex-column align-center justify-center h-100 text-primary">
        <v-icon :icon="mdiCameraOutline" size="32" />
        <span class="text-caption">{{ t('recipes.image.label') }}</span>
      </div>
      <v-btn
        v-if="imageUrl"
        :icon="mdiClose"
        size="x-small"
        variant="flat"
        class="position-absolute top-0 right-0 ma-1"
        :aria-label="t('recipes.image.remove')"
        @click.stop="clear"
      />
      <v-overlay :model-value="uploading" contained persistent class="align-center justify-center">
        <v-progress-circular indeterminate color="primary" />
      </v-overlay>
    </v-card>
    <v-alert v-if="error" type="error" density="compact" :text="error" class="mt-2" />
  </div>
</template>
