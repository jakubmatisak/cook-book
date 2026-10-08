import {
  mdiBabyFaceOutline,
  mdiBowlMixOutline,
  mdiBreadSliceOutline,
  mdiCakeVariantOutline,
  mdiCupOutline,
  mdiDotsHorizontalCircleOutline,
  mdiFoodAppleOutline,
  mdiFoodDrumstickOutline,
  mdiPotSteamOutline,
  mdiRice,
  mdiSoySauce,
} from '@mdi/js'
import type { RecipeCategory } from '@shared/recipes'

/** Ikony typov jedla na úvodnej stránke. */
export const CATEGORY_ICONS: Record<RecipeCategory, string> = {
  polievka: mdiPotSteamOutline,
  hlavne: mdiFoodDrumstickOutline,
  priloha: mdiRice,
  omacka: mdiSoySauce,
  salat: mdiBowlMixOutline,
  dezert: mdiCakeVariantOutline,
  ranajky: mdiBreadSliceOutline,
  desiata: mdiFoodAppleOutline,
  napoj: mdiCupOutline,
  detske: mdiBabyFaceOutline,
  ine: mdiDotsHorizontalCircleOutline,
}
