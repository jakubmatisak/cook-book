/** Verzia z `package.json`, vložená pri builde (pozri `define` vo `vite.config.ts`). */
declare const __APP_VERSION__: string | undefined

/** Štádium aplikácie; pri vydaní stabilnej verzie sa zmení na prázdny text. */
export const APP_STAGE = ''

export const formatAppVersion = (version: string, stage: string): string =>
  stage ? `${version} ${stage}` : version

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'
export const APP_VERSION_LABEL = formatAppVersion(APP_VERSION, APP_STAGE)
