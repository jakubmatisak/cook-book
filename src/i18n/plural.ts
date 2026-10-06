/**
 * Pravidlo množného čísla pre slovenčinu so 3 tvarmi: 1 porcia | 2–4 porcie | 0 a 5+ porcií.
 * Desatinné čísla (1,5) idú do druhého tvaru („1,5 porcie“). Pre 2 tvary (angličtina a pod.) platí 1 | ostatné.
 */
export function skPluralRule(choice: number, choicesLength: number): number {
  if (choicesLength !== 3) return choice === 1 ? 0 : 1
  if (!Number.isInteger(choice)) return 1
  if (choice === 1) return 0
  if (choice >= 2 && choice <= 4) return 1
  return 2
}
