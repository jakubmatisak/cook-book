import { formatQuantity, type QuantityFormat, type UnitCode } from './units'

/** Jednotky, ktoré sa dávkujú po štvrtinách (1 ½ PL, 2 ¼ šálky). */
const QUARTER_UNITS: ReadonlySet<UnitCode> = new Set(['ks', 'PL', 'ČL', 'šálka', 'balenie', 'štipka'])
const MASS_OR_VOLUME: ReadonlySet<UnitCode> = new Set(['g', 'ml'])

const roundQuarter = (n: number) => Math.max(0.25, Math.round(n * 4) / 4)

/**
 * Prepočíta množstvo receptu na iný počet porcií a zaokrúhli tak, ako sa to dá v kuchyni odmerať:
 * kusy a lyžice na štvrtiny, gramy a mililitre na celé (nad 100 na päťky), kg a l na 2 desatinné miesta.
 */
export function scaleQuantity(quantity: number | null, factor: number, unit: UnitCode | null): number | null {
  if (quantity === null) return null
  const scaled = quantity * factor
  if (unit && QUARTER_UNITS.has(unit)) return roundQuarter(scaled)
  if (unit && MASS_OR_VOLUME.has(unit)) {
    return scaled > 100 ? Math.round(scaled / 5) * 5 : Math.max(1, Math.round(scaled))
  }
  return Math.round(scaled * 100) / 100
}

const FRACTIONS: Readonly<Record<number, string>> = { 0.25: '¼', 0.5: '½', 0.75: '¾' }

/** 4,5 → „4 ½“, 0,25 → „¼“, 1,3 → „1,3“. */
export function formatFraction(
  value: number,
  number: (n: number) => string = (n) => String(n).replace('.', ','),
): string {
  const whole = Math.floor(value)
  const symbol = FRACTIONS[Math.round((value - whole) * 100) / 100]
  if (symbol) return whole > 0 ? `${whole} ${symbol}` : symbol
  return number(Math.round(value * 100) / 100)
}

/** Prepočítané množstvo ako text: zlomky pre kusy a lyžice, inak bežný formát (g → kg od 1000). */
export function formatScaled(
  quantity: number | null,
  factor: number,
  unit: UnitCode | null,
  fmt?: QuantityFormat,
): string {
  // Pôvodné porcie: množstvo presne tak, ako je v recepte (bez zaokrúhľovania na štvrtiny).
  if (factor === 1) return formatQuantity(quantity, unit, fmt)
  const scaled = scaleQuantity(quantity, factor, unit)
  if (scaled !== null && unit && QUARTER_UNITS.has(unit)) {
    return `${formatFraction(scaled, fmt?.number)} ${fmt ? fmt.unit(unit) : unit}`
  }
  return formatQuantity(scaled, unit, fmt)
}
