import {
  mdiAccountGroupOutline,
  mdiBookOpenPageVariantOutline,
  mdiCalendarMonthOutline,
  mdiCartOutline,
  mdiCogOutline,
  mdiFormatListChecks,
  mdiFridgeOutline,
  mdiTagMultipleOutline,
  mdiViewDashboardOutline,
} from '@mdi/js'

export interface NavItem {
  to: string
  /** Kľúč názvu v i18n (`common.nav.*`). */
  titleKey: string
  icon: string
  /** Aktívna len na presnej adrese (úvod `/` by inak svietil na každej stránke). */
  exact?: boolean
}

/** Hlavné stránky: v bočnom menu aj v spodnej navigácii na mobile. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { to: '/', titleKey: 'common.nav.home', icon: mdiViewDashboardOutline, exact: true },
  { to: '/recipes', titleKey: 'common.nav.recipes', icon: mdiBookOpenPageVariantOutline },
  { to: '/plan', titleKey: 'common.nav.plan', icon: mdiCalendarMonthOutline },
  { to: '/shopping', titleKey: 'common.nav.shopping', icon: mdiCartOutline },
]

/** Ďalšie stránky: v bočnom menu pod oddeľovačom, na mobile v menu otvorenom tlačidlom. */
export const SECONDARY_NAV: readonly NavItem[] = [
  { to: '/people', titleKey: 'common.nav.family', icon: mdiAccountGroupOutline },
  { to: '/ingredients', titleKey: 'common.nav.ingredients', icon: mdiFormatListChecks },
  { to: '/tags', titleKey: 'common.nav.tags', icon: mdiTagMultipleOutline },
  { to: '/pantry', titleKey: 'common.nav.pantry', icon: mdiFridgeOutline },
  { to: '/settings', titleKey: 'common.nav.settings', icon: mdiCogOutline },
]

export const NAV_ITEMS: readonly NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV]
