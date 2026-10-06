import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { sk } from 'vuetify/locale'
import 'vuetify/styles'
import { colors } from '@/design/tokens'

/**
 * Jediné miesto, kde sa určuje vzhľad: téma (farby) a predvolené props komponentov.
 * Komponenty v aplikácii používajú len Vuetify komponenty a utility triedy.
 * Zaoblenie je hranatejšie (škála v src/design/settings.scss: sm 2 px, md 4 px, lg 6 px).
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
      VBtn: { rounded: 'sm', variant: 'flat' },
      VCard: { rounded: 'md', variant: 'flat', border: true },
      VSheet: { rounded: 'md' },
      VTextField: { variant: 'outlined', density: 'comfortable', color: 'primary', rounded: 'sm' },
      VTextarea: { variant: 'outlined', density: 'comfortable', color: 'primary', rounded: 'sm' },
      VSelect: { variant: 'outlined', density: 'comfortable', color: 'primary', rounded: 'sm' },
      // autocomplete: 'suppress' – Vuetify vypne dopĺňanie prehliadača aj ponuku uložených hodnôt (inak sa pod poľom
      // ukážu náhodné návrhy, napr. „All users“).
      VAutocomplete: {
        variant: 'outlined',
        density: 'comfortable',
        color: 'primary',
        rounded: 'sm',
        autocomplete: 'suppress',
      },
      VCombobox: {
        variant: 'outlined',
        density: 'comfortable',
        color: 'primary',
        rounded: 'sm',
        autocomplete: 'suppress',
      },
      VNumberInput: { variant: 'outlined', density: 'comfortable', color: 'primary', rounded: 'sm' },
      VChip: { rounded: 'sm' },
      VAlert: { rounded: 'md', variant: 'tonal' },
      // Horné odsadenie obsahu: bez neho Vuetify po nadpise karty odsadenie nuluje a plávajúci popis poľa sa orezá.
      // Okno sa zatvára len tlačidlom (Zrušiť, Uložiť, krížik), nie kliknutím vedľa: inak sa pri nechcenom
      // kliknutí zmaže všetko rozpísané.
      VDialog: { scrollable: true, persistent: true, VCardText: { class: 'pt-3' } },
      VAppBar: { flat: true, color: 'background' },
      VBottomNavigation: { grow: true, color: 'primary', bgColor: 'surface' },
      VNavigationDrawer: { color: 'surface' },
      VList: { color: 'primary' },
      VSnackbar: { rounded: 'md' },
      VEmptyState: { color: 'primary', size: 64 },
    },
    locale: { locale: 'sk', fallback: 'sk', messages: { sk } },
    icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  })
