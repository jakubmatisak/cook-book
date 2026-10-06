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
  /** Kľúč názvu v i18n (`common.nav.*`). */
  titleKey: string
  icon: string
}

/** Hlavné stránky: v bočnom menu aj v spodnej navigácii na mobile. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { to: '/recepty', titleKey: 'common.nav.recipes', icon: mdiBookOpenPageVariantOutline },
  { to: '/plan', titleKey: 'common.nav.plan', icon: mdiCalendarMonthOutline },
  { to: '/nakup', titleKey: 'common.nav.shopping', icon: mdiCartOutline },
]

/** Ďalšie stránky: v bočnom menu pod oddeľovačom, na mobile v menu otvorenom tlačidlom. */
export const SECONDARY_NAV: readonly NavItem[] = [
  { to: '/rodina', titleKey: 'common.nav.family', icon: mdiAccountGroupOutline },
  { to: '/ingrediencie', titleKey: 'common.nav.ingredients', icon: mdiFormatListChecks },
  { to: '/tagy', titleKey: 'common.nav.tags', icon: mdiTagMultipleOutline },
  { to: '/spajza', titleKey: 'common.nav.pantry', icon: mdiFridgeOutline },
  { to: '/nastavenia', titleKey: 'common.nav.settings', icon: mdiCogOutline },
]

export const NAV_ITEMS: readonly NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV]
