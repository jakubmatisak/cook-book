import { formatScaled as sharedFormatScaled } from '@shared/scaling'
import { formatQuantity as sharedFormatQuantity, type QuantityFormat, type UnitCode } from '@shared/units'
import { formatNumber } from './format'
import { t } from './index'

/** Krátky zápis jednotky podľa jazyka (sk: PL, ČL, ks; en: tbsp, tsp, pcs). */
export const unitText = (unit: UnitCode): string => t(`common.unitShort.${unit}`)

const FORMAT: QuantityFormat = { number: formatNumber, unit: unitText }

/** Množstvo s jednotkou v jazyku aplikácie: desatinná čiarka/bodka, g → kg a ml → l od 1000. */
export const formatQuantity = (quantity: number | null, unit: UnitCode | null): string =>
  sharedFormatQuantity(quantity, unit, FORMAT)

/** Šírka stĺpca s množstvom: rovnaká pre všetky riadky receptu, aby sa zmestilo aj „0,5 balenie“. */
export const quantityColumnWidth = (labels: string[]): string =>
  `${Math.max(8, ...labels.map((label) => label.length + 1))}ch`

/** Prepočítané množstvo (zlomky pre kusy a lyžice) v jazyku aplikácie. */
export const formatScaled = (quantity: number | null, factor: number, unit: UnitCode | null): string =>
  sharedFormatScaled(quantity, factor, unit, FORMAT)
