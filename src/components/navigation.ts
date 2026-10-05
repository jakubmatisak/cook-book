import {
  mdiAccountGroupOutline,
  mdiBookOpenPageVariantOutline,
  mdiCalendarMonthOutline,
  mdiCartOutline,
  mdiCogOutline,
  mdiFormatListChecks,
  mdiFridgeOutline,
  mdiTagMultipleOutline,
} from '@mdi/js'

export interface NavItem {
  to: string
  title: string
  icon: string
}

/** Hlavné stránky: v bočnom menu aj v spodnej navigácii na mobile. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { to: '/recepty', title: 'Recepty', icon: mdiBookOpenPageVariantOutline },
  { to: '/plan', title: 'Plán', icon: mdiCalendarMonthOutline },
  { to: '/nakup', title: 'Nákup', icon: mdiCartOutline },
]

/** Ďalšie stránky: v bočnom menu pod oddeľovačom, na mobile v menu otvorenom tlačidlom. */
export const SECONDARY_NAV: readonly NavItem[] = [
  { to: '/rodina', title: 'Rodina', icon: mdiAccountGroupOutline },
  { to: '/ingrediencie', title: 'Ingrediencie', icon: mdiFormatListChecks },
  { to: '/tagy', title: 'Tagy', icon: mdiTagMultipleOutline },
  { to: '/spajza', title: 'Špajza', icon: mdiFridgeOutline },
  { to: '/nastavenia', title: 'Nastavenia', icon: mdiCogOutline },
]

export const NAV_ITEMS: readonly NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV]
