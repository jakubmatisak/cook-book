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
  <v-card>
    <input ref="input" type="file" accept="image/*" class="d-none" data-test="image-input" @change="onFile" />
    <v-img v-if="imageUrl" :src="imageUrl" :aspect-ratio="16 / 9" cover>
      <div v-if="uploading" class="d-flex align-center justify-center h-100">
        <v-progress-circular indeterminate color="primary" />
      </div>
    </v-img>
    <v-responsive v-else :aspect-ratio="16 / 9" class="bg-surface-variant">
      <div class="d-flex align-center justify-center h-100">
        <v-btn
          variant="text"
          color="primary"
          size="large"
          :prepend-icon="mdiCameraOutline"
          :loading="uploading"
          @click="input?.click()"
        >
          Pridať fotku
        </v-btn>
      </div>
    </v-responsive>
    <v-card-actions v-if="imageUrl">
      <v-btn variant="tonal" :prepend-icon="mdiImageEditOutline" :loading="uploading" @click="input?.click()">
        Zmeniť fotku
      </v-btn>
      <v-btn variant="text" :prepend-icon="mdiDeleteOutline" @click="clear">Odstrániť</v-btn>
    </v-card-actions>
    <v-alert v-if="error" type="error" density="compact" :text="error" class="ma-3" />
  </v-card>
</template>
