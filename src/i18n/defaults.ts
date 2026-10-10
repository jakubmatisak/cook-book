import { currentLocale, t } from './index'

/**
 * Predvolené názvy jedál dňa a kategórií obchodu sa zakladajú po slovensky ako dáta domácnosti. Kým ich domácnosť
 * nepremenuje, zobrazujú sa v jazyku aplikácie; premenované názvy ostávajú tak, ako ich zadala.
 */
const SLOT_KEYS: Readonly<Record<string, string>> = {
  Raňajky: 'breakfast',
  Desiata: 'snack',
  Obed: 'lunch',
  Olovrant: 'afternoonSnack',
  Večera: 'dinner',
}

const SHOP_CATEGORY_KEYS: Readonly<Record<string, string>> = {
  Zelenina: 'vegetables',
  Ovocie: 'fruit',
  'Mäso a ryby': 'meatFish',
  'Mliečne a vajcia': 'dairyEggs',
  Pečivo: 'bakery',
  Pečenie: 'baking',
  Trvanlivé: 'pantry',
  'Konzervy a zaváraniny': 'preserves',
  'Koreniny a dochucovadlá': 'spices',
  Mrazené: 'frozen',
  Nápoje: 'drinks',
  Drogéria: 'household',
  Iné: 'other',
}

const translated = (table: Readonly<Record<string, string>>, group: string, name: string): string => {
  const key = table[name]
  return key && currentLocale() !== 'sk' ? t(`common.defaults.${group}.${key}`) : name
}

export const slotName = (name: string): string => translated(SLOT_KEYS, 'slot', name)
/** Kľúč predvoleného jedla dňa (`breakfast`, `lunch`…), pre premenované undefined. */
export const defaultSlotKey = (name: string): string | undefined => SLOT_KEYS[name]
export const shopCategoryName = (name: string): string => translated(SHOP_CATEGORY_KEYS, 'shopCategory', name)

export const DEFAULT_SLOT_KEYS = Object.values(SLOT_KEYS)
export const DEFAULT_SHOP_CATEGORY_KEYS = Object.values(SHOP_CATEGORY_KEYS)
