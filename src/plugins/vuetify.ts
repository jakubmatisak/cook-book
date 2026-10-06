import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'
import { useI18n } from 'vue-i18n'
import 'vuetify/styles'
import { colors } from '@/design/tokens'
import { i18n as appI18n } from '@/i18n'

/**
 * Jediné miesto, kde sa určuje vzhľad: téma (farby) a predvolené props komponentov.
 * Komponenty v aplikácii používajú len Vuetify komponenty a utility triedy.
 * Zaoblenie je hranatejšie (škála v src/design/settings.scss: sm 2 px, md 4 px, lg 6 px).
 */
type AdapterI18n = Parameters<typeof createVueI18nAdapter>[0]['i18n']

export const createAppVuetify = (i18n: AdapterI18n = appI18n as unknown as AdapterI18n) =>
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
        // Po výbere položky sa napísané hľadanie zmaže, nech nezostáva v poli.
        clearOnSelect: true,
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
    // Texty Vuetify (kalendár, tabuľky, …) idú cez vue-i18n, takže sa menia spolu s jazykom aplikácie.
    locale: { adapter: createVueI18nAdapter({ i18n, useI18n }) },
    icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  })
