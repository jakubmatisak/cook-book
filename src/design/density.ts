import type { Density } from '@shared/userSettings'

/**
 * Komponenty, ktorým hustota rozhrania mení výšku: polia, výbery, tlačidlá, zoznamy, tabuľky a lišty.
 * Komponent s vlastnou `density` v šablóne si ju nechá (napr. vždy kompaktné riadky ingrediencií).
 */
const DENSITY_COMPONENTS = [
  'VTextField',
  'VTextarea',
  'VSelect',
  'VAutocomplete',
  'VCombobox',
  'VNumberInput',
  'VFileInput',
  'VSwitch',
  'VCheckbox',
  'VRadioGroup',
  'VBtn',
  'VBtnToggle',
  'VBtnGroup',
  'VList',
  'VDataTable',
  'VToolbar',
  'VTabs',
] as const

/** Predvolené props Vuetify pre zvolenú hustotu (pre `v-defaults-provider`). */
export const densityDefaults = (density: Density): Record<string, { density: Density }> =>
  Object.fromEntries(DENSITY_COMPONENTS.map((name) => [name, { density }]))
