import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi-svg";
import { sk } from "vuetify/locale";
import "vuetify/styles";
import { colors, radius } from "@/design/tokens";

/** Nová inštancia Vuetify (testy si vytvárajú vlastnú, aby sa nezdieľal stav displeja). */
export const createAppVuetify = () =>
  createVuetify({
    theme: {
      defaultTheme: "light",
      themes: {
        light: { dark: false, colors: { ...colors.light } },
        dark: { dark: true, colors: { ...colors.dark } },
      },
    },
    defaults: {
      VBtn: { rounded: radius.control, variant: "flat" },
      VCard: { rounded: radius.card, variant: "flat", border: true },
      VTextField: {
        variant: "outlined",
        density: "comfortable",
        color: "primary",
      },
      VTextarea: {
        variant: "outlined",
        density: "comfortable",
        color: "primary",
      },
      VSelect: {
        variant: "outlined",
        density: "comfortable",
        color: "primary",
      },
      VAutocomplete: {
        variant: "outlined",
        density: "comfortable",
        color: "primary",
      },
      VChip: { rounded: radius.control },
      VAppBar: { flat: true, color: "background" },
      VBottomNavigation: { grow: true, color: "primary" },
      VNavigationDrawer: { color: "surface" },
      VList: { color: "primary" },
      VSnackbar: { rounded: radius.control },
    },
    locale: { locale: "sk", fallback: "sk", messages: { sk } },
    icons: { defaultSet: "mdi", aliases, sets: { mdi } },
  });
