<script setup lang="ts">
import {
  mdiAccountMultiplePlusOutline,
  mdiContentCopy,
  mdiEarth,
  mdiLinkVariant,
  mdiLinkVariantOff,
  mdiShareVariantOutline,
} from '@mdi/js'
import { useI18n } from 'vue-i18n'
import type { RecipeDetailDto } from '@shared/api'

/**
 * Jedno okno na všetky spôsoby zdieľania receptu: s konkrétnymi ľuďmi (e-mail), odkazom, verejne v aplikácii
 * a ako text cez systémové zdieľanie. Samotné akcie robí detail receptu (udalosť `choose`).
 */
export type ShareChoice = 'people' | 'link' | 'link-copy' | 'link-stop' | 'public' | 'text'

const open = defineModel<boolean>({ required: true })
defineProps<{ recipe: RecipeDetailDto; canPublish: boolean; canShareText: boolean }>()
const emit = defineEmits<{ choose: [choice: ShareChoice] }>()
const { t } = useI18n()

function choose(choice: ShareChoice) {
  open.value = false
  emit('choose', choice)
}
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card :title="t('recipes.share.title')" :subtitle="recipe.title">
      <v-card-text class="pa-2">
        <v-list lines="three" data-test="share-options">
          <v-list-item
            :prepend-icon="mdiAccountMultiplePlusOutline"
            :title="t('recipes.share.people')"
            :subtitle="
              recipe.sharedWith?.length
                ? t('sharing.recipe.sharedWith', { names: recipe.sharedWith.join(', ') })
                : t('recipes.share.peopleText')
            "
            data-test="share-with"
            @click="choose('people')"
          />
          <v-list-item
            :prepend-icon="mdiLinkVariant"
            :title="t('recipes.share.link')"
            :subtitle="recipe.shareToken ? t('recipes.share.linkActive') : t('recipes.share.linkText')"
            data-test="share-link"
            @click="choose(recipe.shareToken ? 'link-copy' : 'link')"
          >
            <template v-if="recipe.shareToken" #append>
              <div class="d-flex ga-1">
                <v-btn
                  :icon="mdiContentCopy"
                  variant="text"
                  size="small"
                  :aria-label="t('recipes.detail.copyLink')"
                  :title="t('recipes.detail.copyLink')"
                  @click.stop="choose('link-copy')"
                />
                <v-btn
                  :icon="mdiLinkVariantOff"
                  variant="text"
                  size="small"
                  :aria-label="t('recipes.detail.stopSharing')"
                  :title="t('recipes.detail.stopSharing')"
                  data-test="share-link-stop"
                  @click.stop="choose('link-stop')"
                />
              </div>
            </template>
          </v-list-item>
          <v-list-item
            v-if="canPublish"
            :prepend-icon="mdiEarth"
            :title="t('recipes.share.public')"
            :subtitle="
              recipe.visibility === 'public' ? t('recipes.share.publicActive') : t('recipes.share.publicText')
            "
            data-test="visibility"
            @click="choose('public')"
          />
          <v-list-item
            v-if="canShareText"
            :prepend-icon="mdiShareVariantOutline"
            :title="t('recipes.share.text')"
            :subtitle="t('recipes.share.textText')"
            data-test="share"
            @click="choose('text')"
          />
        </v-list>
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.close') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
