import { mdiBookOpenPageVariantOutline, mdiCalendarMonthOutline, mdiCartOutline, mdiDotsHorizontal } from '@mdi/js'

export interface NavItem {
  to: string
  title: string
  icon: string
}

/** Hlavná navigácia: spodná lišta na mobile, bočná lišta na desktope. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/recepty', title: 'Recepty', icon: mdiBookOpenPageVariantOutline },
  { to: '/plan', title: 'Plán', icon: mdiCalendarMonthOutline },
  { to: '/nakup', title: 'Nákup', icon: mdiCartOutline },
  { to: '/viac', title: 'Viac', icon: mdiDotsHorizontal },
]
