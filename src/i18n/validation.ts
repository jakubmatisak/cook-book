import { currentLocale, t } from './index'

/**
 * Hlášky overenia zo `shared/schemas` sú po slovensky (rovnaké schémy overujú aj server). V iných jazykoch sa známe
 * hlášky preložia podľa tejto tabuľky (`common.validation.<kľúč>`), neznáme ostanú, ako prišli.
 */
const KEYS: Readonly<Record<string, string>> = {
  'Krok nesmie byť prázdny.': 'stepEmpty',
  'Množstvo musí byť kladné.': 'quantityPositive',
  'Neplatný dátum.': 'invalidDate',
  'Názov môže mať najviac 60 znakov.': 'nameMax60',
  'Príliš veľa filtrov.': 'tooManyFilters',
  'Rytmus musí byť celé číslo týždňov.': 'rhythmWeeks',
  'Vyber recept alebo napíš, čo sa bude jesť.': 'pickRecipeOrText',
  'Zadaj dátum vo formáte RRRR-MM-DD.': 'dateFormat',
  'Zadaj názov domácnosti.': 'householdName',
  'Zadaj názov ingrediencie.': 'ingredientName',
  'Zadaj názov položky.': 'itemName',
  'Zadaj názov receptu.': 'recipeName',
  'Zadaj názov tagu.': 'tagName',
  'Zadaj názov šablóny.': 'templateName',
  'Zadaj platnú webovú adresu (http alebo https).': 'urlHttp',
  'Zadaj platnú webovú adresu.': 'url',
  'Zadaj platný e-mail.': 'email',
  'Zadaj, čo kúpiť.': 'whatToBuy',
  'Čas v tvare HH:MM.': 'timeFormat',
}

/** Hláška overenia v aktuálnom jazyku (slovenčina: pôvodný text). */
export function validationText(message: string): string {
  const key = KEYS[message]
  return key && currentLocale() !== 'sk' ? t(`common.validation.${key}`) : message
}

export const VALIDATION_KEYS = Object.values(KEYS)
