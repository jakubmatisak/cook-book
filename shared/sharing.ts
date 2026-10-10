/** Čo sa zdieľa: vybrané recepty, celá kategória (typ jedla) alebo celý tag. */
export const SHARE_KINDS = ['recipes', 'category', 'tag'] as const
export type ShareKind = (typeof SHARE_KINDS)[number]

/** Stav ponuky: čaká na príjemcu, prijatá, odmietnutá, zrušená (odosielateľom alebo príjemcom). */
export const SHARE_STATUSES = ['pending', 'accepted', 'declined', 'revoked'] as const
export type ShareStatus = (typeof SHARE_STATUSES)[number]

/** Limity zdieľania (aj kvôli limitom D1 na free pláne). */
export const SHARE_LIMITS = {
  recipients: 20,
  recipes: 200,
  pendingPerHousehold: 100,
  message: 500,
  contactName: 60,
} as const
