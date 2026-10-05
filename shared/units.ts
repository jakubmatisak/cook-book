export type UnitCode = 'g' | 'kg' | 'ml' | 'l' | 'ks' | 'PL' | 'ČL' | 'šálka' | 'balenie' | 'štipka'

export interface UnitDef {
  code: UnitCode
  label: string
  /** Prevod na základnú jednotku: quantity * factor = množstvo v `unit`. */
  base?: { unit: UnitCode; factor: number }
}

export const UNIT_CODES = [
  'g',
  'kg',
  'ml',
  'l',
  'ks',
  'PL',
  'ČL',
  'šálka',
  'balenie',
  'štipka',
] as const satisfies readonly UnitCode[]

export const UNITS: readonly UnitDef[] = [
  { code: 'g', label: 'gram' },
  { code: 'kg', label: 'kilogram', base: { unit: 'g', factor: 1000 } },
  { code: 'ml', label: 'mililiter' },
  { code: 'l', label: 'liter', base: { unit: 'ml', factor: 1000 } },
  { code: 'ks', label: 'kus' },
  { code: 'PL', label: 'polievková lyžica' },
  { code: 'ČL', label: 'čajová lyžička' },
  { code: 'šálka', label: 'šálka' },
  { code: 'balenie', label: 'balenie' },
  { code: 'štipka', label: 'štipka' },
]

/**
 * Slovenské tvary jednotiek písané bežne (skloňované, plné slová) → kód jednotky.
 * Kľúče sú bez diakritiky a malými písmenami (porovnáva sa cez `normalizeText`).
 */
export const UNIT_ALIASES: Readonly<Record<string, UnitCode>> = {
  gram: 'g',
  gramy: 'g',
  gramov: 'g',
  kilo: 'kg',
  kila: 'kg',
  kilogram: 'kg',
  kilogramy: 'kg',
  kilogramov: 'kg',
  mililiter: 'ml',
  mililitre: 'ml',
  mililitrov: 'ml',
  liter: 'l',
  litre: 'l',
  litra: 'l',
  litrov: 'l',
  kus: 'ks',
  kusy: 'ks',
  kusov: 'ks',
  lyzica: 'PL',
  lyzice: 'PL',
  lyzic: 'PL',
  lyzicka: 'ČL',
  lyzicky: 'ČL',
  lyzicok: 'ČL',
  salka: 'šálka',
  salky: 'šálka',
  salok: 'šálka',
  balenia: 'balenie',
  baleni: 'balenie',
  stipky: 'štipka',
  stipok: 'štipka',
}

const byCode = new Map<string, UnitDef>(UNITS.map((u) => [u.code, u]))

export const isUnitCode = (value: string): value is UnitCode => byCode.has(value)

export function toBase(quantity: number, unit: UnitCode): { quantity: number; unit: UnitCode } {
  const base = byCode.get(unit)?.base
  return base ? { quantity: quantity * base.factor, unit: base.unit } : { quantity, unit }
}

const PROMOTE: Partial<Record<UnitCode, UnitCode>> = { g: 'kg', ml: 'l' }
const numberFormat = new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 2, useGrouping: false })

/** Zobrazí množstvo po slovensky: desatinná čiarka, g → kg a ml → l od 1000. */
export function formatQuantity(quantity: number | null, unit: UnitCode | null): string {
  const valid = quantity !== null && Number.isFinite(quantity) && quantity > 0
  if (!valid) return unit ?? ''
  let q = quantity
  let u = unit
  const promoted = u ? PROMOTE[u] : undefined
  if (promoted && q >= 1000) {
    q = q / 1000
    u = promoted
  }
  const n = numberFormat.format(q)
  return u ? `${n} ${u}` : n
}
