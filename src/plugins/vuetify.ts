import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { sk } from 'vuetify/locale'
import 'vuetify/styles'
import { colors } from '@/design/tokens'

/**
 * Jediné miesto, kde sa určuje vzhľad: téma (farby) a predvolené props komponentov.
 * Komponenty v aplikácii používajú len Vuetify komponenty a utility triedy.
 */
export const createAppVuetify = () =>
  createVuetify({
    theme: {
      defaultTheme: 'light',
      themes: {
        light: { dark: false, colors: { ...colors.light } },
        dark: { dark: true, colors: { ...colors.dark } },
      },
    },
    defaults: {
      VBtn: { rounded: 'lg', variant: 'flat' },
      VCard: { rounded: 'lg', variant: 'flat', border: true },
      VSheet: { rounded: 'lg' },
      VTextField: { variant: 'outlined', density: 'comfortable', color: 'primary' },
      VTextarea: { variant: 'outlined', density: 'comfortable', color: 'primary' },
      VSelect: { variant: 'outlined', density: 'comfortable', color: 'primary' },
      VAutocomplete: { variant: 'outlined', density: 'comfortable', color: 'primary' },
      VCombobox: { variant: 'outlined', density: 'comfortable', color: 'primary' },
      VNumberInput: { variant: 'outlined', density: 'comfortable', color: 'primary' },
      VChip: { rounded: 'lg' },
      VAlert: { rounded: 'lg', variant: 'tonal' },
      VDialog: { scrollable: true },
      VAppBar: { flat: true, color: 'background' },
      VBottomNavigation: { grow: true, color: 'primary', bgColor: 'surface' },
      VNavigationDrawer: { color: 'surface' },
      VList: { color: 'primary' },
      VSnackbar: { rounded: 'lg' },
      VEmptyState: { color: 'primary', size: 64 },
    },
    locale: { locale: 'sk', fallback: 'sk', messages: { sk } },
    icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  })
