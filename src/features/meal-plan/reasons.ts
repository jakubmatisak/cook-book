import { messages, t } from '@/i18n'

/**
 * Dôvody návrhov „čo uvariť dnes“ posiela server po slovensky (zdieľaná logika `shared/suggest.ts`). Klient ich
 * rozpozná podľa slovenských šablón a zobrazí preklad v aktuálnom jazyku; neznámy dôvod ostane, aký prišiel.
 */
interface Matcher {
  key: string
  pattern: RegExp
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Slovenská šablóna s `{zástupnými}` znakmi → regulárny výraz s pomenovanými skupinami. */
const toPattern = (template: string): RegExp =>
  new RegExp(
    `^${template
      .split(/(\{\w+\})/)
      .map((part) => {
        const name = /^\{(\w+)\}$/.exec(part)?.[1]
        return name ? `(?<${name}>.+)` : escapeRegExp(part)
      })
      .join('')}$`,
  )

const lookup = (path: string): string => {
  let node: unknown = messages.sk
  for (const segment of path.split('.')) node = (node as Record<string, unknown> | undefined)?.[segment]
  return typeof node === 'string' ? node : ''
}

const REASON_KEYS = [
  'plan.suggestions.reasons.allAtHome',
  'plan.suggestions.reasons.missing',
  'plan.suggestions.reasons.neverCooked',
  'plan.suggestions.reasons.cookedToday',
  'plan.suggestions.reasons.yesterday',
  'plan.suggestions.reasons.daysAgo',
  'plan.suggestions.reasons.weeksAgo',
  'plan.suggestions.reasons.monthsAgo',
  'plan.suggestions.reasons.overYear',
  'plan.suggestions.reasons.favorite',
  'common.preference.warning.dislike',
]

const matchers: Matcher[] = REASON_KEYS.map((key) => ({ key, pattern: toPattern(lookup(key)) }))

export interface ReasonView {
  text: string
  color: 'success' | 'warning' | undefined
}

export function describeReason(reason: string): ReasonView {
  for (const { key, pattern } of matchers) {
    const match = pattern.exec(reason)
    if (!match) continue
    const color = key.endsWith('.allAtHome') ? 'success' : key.endsWith('.missing') ? 'warning' : undefined
    return { text: t(key, { ...match.groups }), color }
  }
  return { text: reason, color: undefined }
}
