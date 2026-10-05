<script setup lang="ts">
import { mdiCameraOutline, mdiDeleteOutline, mdiImageEditOutline } from '@mdi/js'
import { ref } from 'vue'
import { uploadImage } from '@/api/recipes'
import { resizeImage } from '@/lib/image'

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
    error.value = e instanceof Error ? e.message : 'Fotku sa nepodarilo nahrať.'
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
  <div class="tw:flex tw:flex-col tw:gap-2">
    <input
      ref="input"
      type="file"
      accept="image/*"
      class="tw:hidden"
      data-test="image-input"
      @change="onFile"
    />
    <div
      class="tw:relative tw:flex tw:aspect-[16/9] tw:items-center tw:justify-center tw:overflow-hidden tw:rounded-2xl tw:bg-surface-variant"
    >
      <v-img v-if="imageUrl" :src="imageUrl" cover class="tw:absolute tw:inset-0" />
      <v-btn
        v-else
        variant="text"
        color="primary"
        size="large"
        :prepend-icon="mdiCameraOutline"
        :loading="uploading"
        @click="input?.click()"
      >
        Pridať fotku
      </v-btn>
      <v-progress-circular v-if="uploading && imageUrl" indeterminate color="primary" class="tw:absolute" />
    </div>
    <div v-if="imageUrl" class="tw:flex tw:gap-2">
      <v-btn variant="tonal" :prepend-icon="mdiImageEditOutline" :loading="uploading" @click="input?.click()">
        Zmeniť fotku
      </v-btn>
      <v-btn variant="text" :prepend-icon="mdiDeleteOutline" @click="clear">Odstrániť</v-btn>
    </div>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" :text="error" />
  </div>
</template>
