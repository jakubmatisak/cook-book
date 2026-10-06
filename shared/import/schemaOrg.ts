import type { RecipeCategory } from '../recipes'
import type { RecipeInputRaw } from '../schemas/recipe'
import { normalizeText } from '../text'
import { unitFromText, type UnitCode } from '../units'

/**
 * Čistý extraktor receptu z údajov, ktoré Worker pozbieral z HTML stránky.
 * Nič tu nerobí sieťové volania ani nepozná HTMLRewriter, preto sa dá testovať bez prehliadača.
 */

export interface ImportSources {
  /** Texty z `<script type="application/ld+json">`. */
  jsonLd: string[]
  /** `og:*` meta značky (kľúč malými písmenami, napr. `og:title`). */
  meta: Record<string, string>
  /** Hodnoty prvkov s `itemprop` (microdata) v poradí v dokumente. */
  microdata: { prop: string; value: string }[]
  /**
   * Nadpisy skupín ingrediencií (Korpus, Náplň…) a riadky ingrediencií v poradí v dokumente, z HTML značiek známych
   * webov. Skupiny sa k ingredienciám z JSON-LD priradia podľa poradia (pozri `assignIngredientGroups`).
   */
  ingredientMarks?: IngredientMark[]
  sourceUrl: string | null
}

/** Nadpis skupiny, alebo riadok ingrediencie (s textom riadku, ak ho web v HTML má). */
export type IngredientMark = { kind: 'group'; text: string } | { kind: 'row'; text?: string }

export interface ImportedRecipe {
  recipe: RecipeInputRaw
  imageUrl: string | null
  warnings: string[]
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

// ─── Text ─────────────────────────────────────────────────────────────────────

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  deg: '°',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  times: '×',
  middot: '·',
  bull: '•',
  plusmn: '±',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  laquo: '«',
  raquo: '»',
  // slovenská a česká diakritika (veľkosť písmen rozhoduje: Eacute ≠ eacute)
  aacute: 'á',
  Aacute: 'Á',
  auml: 'ä',
  Auml: 'Ä',
  ccaron: 'č',
  Ccaron: 'Č',
  dcaron: 'ď',
  Dcaron: 'Ď',
  eacute: 'é',
  Eacute: 'É',
  ecaron: 'ě',
  Ecaron: 'Ě',
  iacute: 'í',
  Iacute: 'Í',
  lacute: 'ĺ',
  Lacute: 'Ĺ',
  lcaron: 'ľ',
  Lcaron: 'Ľ',
  ncaron: 'ň',
  Ncaron: 'Ň',
  oacute: 'ó',
  Oacute: 'Ó',
  ocirc: 'ô',
  Ocirc: 'Ô',
  ouml: 'ö',
  Ouml: 'Ö',
  racute: 'ŕ',
  Racute: 'Ŕ',
  rcaron: 'ř',
  Rcaron: 'Ř',
  scaron: 'š',
  Scaron: 'Š',
  tcaron: 'ť',
  Tcaron: 'Ť',
  uacute: 'ú',
  Uacute: 'Ú',
  uring: 'ů',
  Uring: 'Ů',
  uuml: 'ü',
  Uuml: 'Ü',
  yacute: 'ý',
  Yacute: 'Ý',
  zcaron: 'ž',
  Zcaron: 'Ž',
  szlig: 'ß',
  agrave: 'à',
  egrave: 'è',
  ecirc: 'ê',
  euml: 'ë',
  ccedil: 'ç',
  ntilde: 'ñ',
  acirc: 'â',
  icirc: 'î',
  ucirc: 'û',
}

const decodeOnce = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1]!.toLowerCase() === 'x' ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1))
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? match
  })

/**
 * Dekóduje HTML entity. Niektoré weby ich v dátach zakódujú dvakrát (`&amp;oacute;`), preto sa dekóduje,
 * kým sa text mení (najviac trikrát).
 */
export function decodeEntities(text: string): string {
  let current = text
  for (let i = 0; i < 3; i++) {
    const next = decodeOnce(current)
    if (next === current) break
    current = next
  }
  return current
}

const BLOCK_END = /<\/(?:p|li|div|h\d)>|<br\s*\/?>/gi

/** Bez značiek a entít, jedna medzera medzi slovami. */
const cleanText = (value: unknown): string =>
  typeof value === 'string'
    ? decodeEntities(value.replace(/<[^>]*>/g, ''))
        .replace(/\s+/g, ' ')
        .trim()
    : ''

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max).trimEnd() : text)

// ─── Čísla a trvania ──────────────────────────────────────────────────────────

/** ISO 8601 trvanie („PT1H30M“) na minúty; nulové, neplatné alebo nie textové je null. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = value.trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i)
  if (!m) return null
  const [, d, h, min, s] = m
  const total =
    Number(d ?? 0) * 1440 + Number(h ?? 0) * 60 + Number(min ?? 0) + Math.ceil(Number(s ?? 0) / 60)
  return total > 0 ? Math.min(total, 1440) : null
}

/** Počet porcií z čísla, textu („Serves 6“) alebo poľa; prvé celé číslo, najviac 50. */
export function parseYield(value: unknown): number | null {
  const first = Array.isArray(value) ? value[0] : value
  const n =
    typeof first === 'number'
      ? Math.trunc(first)
      : typeof first === 'string'
        ? Number.parseInt(first.match(/\d+/)?.[0] ?? '', 10)
        : NaN
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : null
}

// ─── Kategória ────────────────────────────────────────────────────────────────

const CATEGORY_PATTERNS: readonly [RegExp, RecipeCategory][] = [
  [/polievk|soup|vyvar/, 'polievka'],
  [/dezert|dessert|sweet|cake|kolac|torta|zakusk/, 'dezert'],
  [/ranajk|breakfast|brunch/, 'ranajky'],
  [/salat|salad/, 'salat'],
  [/priloh|side/, 'priloha'],
  [/napoj|drink|beverage|cocktail/, 'napoj'],
  [/desiat|snack/, 'desiata'],
  [/hlavn|main course|main dish|entree/, 'hlavne'],
]

/** Prvá rozpoznaná kategória (`recipeCategory`, kľúčové slová), inak null. */
function matchCategory(value: unknown): RecipeCategory | null {
  const items = Array.isArray(value) ? value : [value]
  for (const item of items) {
    const text = normalizeText(cleanText(item))
    const hit = CATEGORY_PATTERNS.find(([pattern]) => pattern.test(text))
    if (hit) return hit[1]
  }
  return null
}

/** Vzory pre názov receptu (bez diakritiky, malými písmenami); užšie než vzory pre kategóriu, aby „rezeň“ nebol rez. */
const TITLE_PATTERNS: readonly [RegExp, RecipeCategory][] = [
  [/\b(?:polievk\w*|kapustnic\w*|gulasovk\w*|vyvar\w*)\b/, 'polievka'],
  [/\bsalat\w*/, 'salat'],
  [
    /\b(?:kolac\w*|tort(?:a|y|u|ou|e)|zakusk\w*|rezy|strudl\w*|zerbo|buchty|buchta|perni\w*|medovnik\w*|cheesecake|tiramisu|pudin\w*|zmrzlin\w*|susienk\w*|keksy|rolka|babovk\w*|makovnik\w*|linecke|palacink\w*|lievance)\b/,
    'dezert',
  ],
  [/\b(?:ranajk\w*|granola|musli|omeleta|praznica)\b/, 'ranajky'],
]

const matchTitleCategory = (title: string): RecipeCategory | null => {
  const text = normalizeText(title)
  return TITLE_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? null
}

/** Názvy z `BreadcrumbList` (omrvinková navigácia: Recepty › Dezerty › …). */
function breadcrumbNames(node: unknown, depth = 0): string[] {
  if (depth > 6) return []
  if (Array.isArray(node)) return node.flatMap((n) => breadcrumbNames(n, depth + 1))
  if (!isObj(node)) return []
  if (hasType(node, 'BreadcrumbList')) {
    return asList(node['itemListElement']).flatMap((entry) => {
      if (!isObj(entry)) return []
      const item = isObj(entry['item']) ? entry['item']['name'] : undefined
      const name = cleanText(entry['name'] ?? item)
      return name ? [name] : []
    })
  }
  return breadcrumbNames(node['@graph'], depth + 1)
}

/** Kategória zo schema.org (`recipeCategory`) na našu; neznáma je hlavné jedlo. */
export function mapCategory(value: unknown): RecipeCategory {
  return matchCategory(value) ?? 'hlavne'
}

/** Slová z kľúčových slov, ktoré nič nehovoria o recepte (webové rubriky), ani ako tag. */
const GENERIC_KEYWORDS: ReadonlySet<string> = new Set([
  'chody',
  'sposob pripravy',
  'recepty',
  'recepty z pravdy',
])

/** Náhodné identifikátory namiesto slov (`9SRXqBzIWSB_VO4XyyiY`): jedno „slovo“ s číslami, podčiarkovníkmi alebo veľkými písmenami uprostred. */
const isOpaqueId = (tag: string): boolean =>
  /^[\w-]{14,}$/.test(tag) && (/\d/.test(tag) || /_/.test(tag) || /[a-z][A-Z]/.test(tag))

const keywordList = (value: unknown): string[] =>
  asList(value).flatMap((v) => (typeof v === 'string' ? v.split(',').map(cleanText).filter(Boolean) : []))

// ─── Ingrediencie ─────────────────────────────────────────────────────────────

const UNICODE_FRACTIONS: Readonly<Record<string, string>> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅛': '1/8',
}

/** Jednotky, ktoré nemáme medzi vlastnými, s prepočtom na naše. */
const FOREIGN_UNITS: Readonly<Record<string, { unit: UnitCode; factor: number }>> = {
  cup: { unit: 'šálka', factor: 1 },
  cups: { unit: 'šálka', factor: 1 },
  tbsp: { unit: 'PL', factor: 1 },
  tbs: { unit: 'PL', factor: 1 },
  tablespoon: { unit: 'PL', factor: 1 },
  tablespoons: { unit: 'PL', factor: 1 },
  tsp: { unit: 'ČL', factor: 1 },
  teaspoon: { unit: 'ČL', factor: 1 },
  teaspoons: { unit: 'ČL', factor: 1 },
  oz: { unit: 'g', factor: 28.35 },
  ounce: { unit: 'g', factor: 28.35 },
  ounces: { unit: 'g', factor: 28.35 },
  lb: { unit: 'g', factor: 453.6 },
  lbs: { unit: 'g', factor: 453.6 },
  pound: { unit: 'g', factor: 453.6 },
  pounds: { unit: 'g', factor: 453.6 },
  pinch: { unit: 'štipka', factor: 1 },
  dl: { unit: 'ml', factor: 100 },
  dkg: { unit: 'g', factor: 10 },
}

const NUMBER = String.raw`\d+(?:[.,]\d+)?`
const RANGE = new RegExp(String.raw`^(${NUMBER})\s*[-–]\s*(${NUMBER})(?=\s|$)`)
const MIXED = /^(\d+)\s+(\d+)\/(\d+)(?=\s|$)/
const FRACTION = /^(\d+)\/(\d+)(?=\s|$)/
const PLAIN = new RegExp(String.raw`^(${NUMBER})`)
const toNumber = (text: string) => Number(text.replace(',', '.'))

/** Počiatočné množstvo riadku (rozsah, zmiešané číslo, zlomok, desatinné) a zvyšok textu. */
function takeQuantity(text: string): { quantity: number; rest: string; range: string | null } | null {
  let m = text.match(RANGE)
  if (m) {
    return { quantity: toNumber(m[1]!), rest: text.slice(m[0].length).trim(), range: `${m[1]}–${m[2]}` }
  }
  m = text.match(MIXED)
  if (m && Number(m[3]) > 0) {
    return {
      quantity: Number(m[1]) + Number(m[2]) / Number(m[3]),
      rest: text.slice(m[0].length).trim(),
      range: null,
    }
  }
  m = text.match(FRACTION)
  if (m && Number(m[2]) > 0) {
    return { quantity: Number(m[1]) / Number(m[2]), rest: text.slice(m[0].length).trim(), range: null }
  }
  m = text.match(PLAIN)
  if (m) return { quantity: toNumber(m[1]!), rest: text.slice(m[0].length).trim(), range: null }
  return null
}

export interface ParsedIngredient {
  name: string
  quantity: number | null
  unit: UnitCode | null
  note: string | null
}

/**
 * „2 (200 g) cibule, nakrájané“ → { name: 'cibule', quantity: 2, note: '200 g, nakrájané' }.
 * Rozumie zlomkom (aj ½), rozsahom, slovenským a anglickým jednotkám. Skloňovanie názvu necháva.
 */
export function parseIngredientLine(raw: string): ParsedIngredient {
  let text = cleanText(raw)
    .replace(/(\d)\s*([¼½¾⅓⅔⅛])/g, (_, digit: string, f: string) => `${digit} ${UNICODE_FRACTIONS[f]}`)
    .replace(/[¼½¾⅓⅔⅛]/g, (f) => UNICODE_FRACTIONS[f]!)

  const parentheses: string[] = []
  text = text
    .replace(/\(([^)]*)\)/g, (_, inner: string) => {
      if (inner.trim()) parentheses.push(inner.trim())
      return ' '
    })
    .replace(/\s+/g, ' ')
    .trim()

  // Čiarka s medzerou oddeľuje poznámku; desatinná čiarka („1,5 dl“) ju nespúšťa.
  let tail = ''
  const comma = text.search(/,\s/)
  if (comma >= 0) {
    tail = text.slice(comma + 1).trim()
    text = text.slice(0, comma).trim()
  }

  const finish = (parsed: Omit<ParsedIngredient, 'note'>, range: string | null): ParsedIngredient => {
    const notes = [range, ...parentheses, tail].filter((n): n is string => Boolean(n))
    return { ...parsed, note: notes.length ? notes.join(', ') : null }
  }
  const whole = () => finish({ name: text, quantity: null, unit: null }, null)

  const q = takeQuantity(text)
  if (!q) return trailingQuantity()
  if (q.quantity === 0 && q.rest) {
    // „0 kocky droždia“: web množstvo zaokrúhlil na nulu, takže je neznáme (jednotka za ním je zbytočná).
    const zeroUnit = takeUnit(q.rest, 0)
    const name = zeroUnit ? zeroUnit.rest : q.rest
    return name ? finish({ name, quantity: null, unit: null }, q.range) : whole()
  }
  if (!(q.quantity > 0) || !q.rest) return whole()

  const unit = takeUnit(q.rest, q.quantity)
  if (unit) {
    if (!unit.rest) return whole()
    return finish({ name: unit.rest, quantity: unit.quantity, unit: unit.unit }, q.range)
  }
  return finish({ name: q.rest, quantity: q.quantity, unit: null }, q.range)

  /**
   * Slovenský zápis „názov, množstvo jednotka“ („cukor práškový, 200 g“, „keksy, 1 bal“): množstvo je až za
   * čiarkou. Text za čiarkou, ktorý nezačína číslom („bielky, sneh zo 4 ks“), ostáva poznámkou.
   */
  function trailingQuantity(): ParsedIngredient {
    const post = tail ? takeQuantity(tail) : null
    if (!post || !(post.quantity > 0) || !text) return whole()
    const unit = post.rest ? takeUnit(post.rest, post.quantity) : null
    const remainder = unit ? unit.rest : post.rest
    const notes = [post.range, ...parentheses, remainder].filter((n): n is string => Boolean(n))
    return {
      name: text,
      quantity: unit ? unit.quantity : post.quantity,
      unit: unit ? unit.unit : null,
      note: notes.length ? notes.join(', ') : null,
    }
  }
}

/** Ak text začína jednotkou („g masla“, „bal“), vráti ju, prepočítané množstvo a zvyšok textu. */
function takeUnit(rest: string, quantity: number): { unit: UnitCode; quantity: number; rest: string } | null {
  const tokens = rest.split(' ')
  const unitToken = tokens[0]!.replace(/[.,]$/, '')
  const foreign = FOREIGN_UNITS[unitToken.toLowerCase()]
  const known = foreign ? foreign.unit : unitFromText(unitToken)
  if (!known) return null
  const converted = foreign && foreign.factor !== 1 ? Math.round(quantity * foreign.factor) : quantity
  return { unit: known, quantity: converted, rest: tokens.slice(1).join(' ') }
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

const hasType = (node: Obj, type: string): boolean => {
  const t = node['@type']
  const types = Array.isArray(t) ? t : [t]
  return types.some((x) => typeof x === 'string' && x.toLowerCase() === type.toLowerCase())
}

/**
 * JSON.parse, ktorý prežije surové nové riadky a tabulátory v reťazcoch (niektoré weby ich tak vkladajú do JSON-LD,
 * čo je neplatný JSON). Také znaky sa v reťazcoch nahradia za \\n, \\r a \\t. Nezachrániteľný text je null.
 */
export function parseJsonLenient(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    // skúsime opraviť
  }
  let out = ''
  let inString = false
  let escaped = false
  for (const ch of raw) {
    if (!inString) {
      if (ch === '"') inString = true
      out += ch
    } else if (escaped) {
      escaped = false
      out += ch
    } else if (ch === '\\') {
      escaped = true
      out += ch
    } else if (ch === '"') {
      inString = false
      out += ch
    } else if (ch === '\n') out += '\\n'
    else if (ch === '\r') out += '\\r'
    else if (ch === '\t') out += '\\t'
    else if (ch.charCodeAt(0) < 0x20) out += ''
    else out += ch
  }
  try {
    return JSON.parse(out)
  } catch {
    return null
  }
}

/** Hľadá uzol Recipe v koreni, poli, `@graph` aj `mainEntity`. */
function findRecipe(node: unknown, depth = 0): Obj | null {
  if (depth > 6) return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item, depth + 1)
      if (found) return found
    }
    return null
  }
  if (!isObj(node)) return null
  if (hasType(node, 'Recipe')) return node
  return findRecipe(node['@graph'], depth + 1) ?? findRecipe(node['mainEntity'], depth + 1)
}

function flattenInstructions(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.replace(BLOCK_END, '\n').split(/\r?\n/).map(cleanText).filter(Boolean)
  }
  if (Array.isArray(value)) return value.flatMap(flattenInstructions)
  if (isObj(value)) {
    if (Array.isArray(value['itemListElement'])) return flattenInstructions(value['itemListElement'])
    return flattenInstructions(value['text'] ?? value['name'])
  }
  return []
}

/** Postup je niekedy jeden dlhý odsek; rozdelí sa po vetách na kroky do cca 300 znakov (nič sa nestratí). */
const LONG_STEP = 400
const STEP_TARGET = 300

export function splitLongStep(steps: string[]): string[] {
  if (steps.length !== 1 || steps[0]!.length <= LONG_STEP) return steps
  const sentences = steps[0]!.split(/(?<=[.!?])\s+(?=[A-ZÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ])/u)
  const grouped: string[] = []
  for (const sentence of sentences) {
    const last = grouped[grouped.length - 1]
    if (last !== undefined && last.length + 1 + sentence.length <= STEP_TARGET) {
      grouped[grouped.length - 1] = `${last} ${sentence}`
    } else grouped.push(sentence)
  }
  return grouped
}

function firstImage(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = firstImage(item)
      if (url) return url
    }
    return null
  }
  return isObj(value) ? firstImage(value['url'] ?? value['contentUrl']) : null
}

const asList = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value]

/** Weby dávajú do kľúčových slov desiatky pojmov (aj mená autorov), preto berieme len prvé. */
const MAX_IMPORTED_TAGS = 8

function splitKeywords(value: unknown): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const tag of keywordList(value)) {
    const key = normalizeText(tag)
    // Preč s hviezdičkovými rubrikami („* Recepty z Pravdy“), všeobecnými slovami a typom jedla (ten je v kategórii).
    if (!/^[\p{L}\p{N}]/u.test(tag) || GENERIC_KEYWORDS.has(key) || matchCategory(tag)) continue
    if (tag.length > 40 || seen.has(key) || isOpaqueId(tag)) continue
    seen.add(key)
    tags.push(tag)
  }
  return tags.slice(0, MAX_IMPORTED_TAGS)
}

function absoluteUrl(url: string | null, base: string | null): string | null {
  if (!url) return null
  try {
    const resolved = new URL(url, base ?? undefined)
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.href : null
  } catch {
    return null
  }
}

const MAX_GROUP_NAME = 80

/**
 * Skupina (na čo sa ingrediencia používa) pre každú z `count` ingrediencií: riadky dostanú posledný nadpis skupiny pred
 * sebou. Platí len keď počet riadkov v HTML sedí s počtom ingrediencií (inak by sa skupiny posunuli) a nájde sa aspoň
 * jedna skupina; inak `null`.
 */
export function assignIngredientGroups(
  count: number,
  marks: readonly IngredientMark[],
): (string | null)[] | null {
  const rows = marks.filter((m) => m.kind === 'row').length
  if (rows === 0 || rows !== count) return null
  const groups: (string | null)[] = []
  let current: string | null = null
  for (const mark of marks) {
    if (mark.kind === 'group') {
      current = clip(cleanText(mark.text).replace(/\s*:\s*$/, ''), MAX_GROUP_NAME) || null
    } else groups.push(current)
  }
  return groups.some(Boolean) ? groups : null
}

/** Zloží `RecipeInputRaw` z uzla podobného schema.org Recipe. */
/**
 * Reklamný dovetok za dvojbodkou („Jablkové rezy: Fantastické!“) sa odreže; krátka alebo všeobecná hlavička
 * („Recept: Guláš“) ostáva.
 */
export function cleanRecipeTitle(title: string): string {
  const trimmed = title.trim()
  const m = /^(.{6,}?):\s+(.{12,})$/.exec(trimmed)
  if (m && !/^(?:recept|tip|video|videorecept|novinka)$/i.test(m[1]!.trim())) return m[1]!.trim()
  return trimmed
}

const stripStepNumber = (text: string) => text.replace(/^\s*\d{1,2}\s*[.:)]\s+/, '')

/** Ingrediencie ako riadky: zoznam reťazcov, alebo jeden reťazec s riadkami či `<br>`. */
const ingredientLines = (value: unknown): string[] =>
  asList(value).flatMap((line) =>
    typeof line === 'string'
      ? line.replace(BLOCK_END, '\n').split(/\r?\n/).map(cleanText).filter(Boolean)
      : [],
  )

/** Riadky bez textu (prázdne odseky medzi skupinami) nie sú ingrediencie. */
const usableMarks = (marks: readonly IngredientMark[]): IngredientMark[] =>
  marks.filter((m) => m.kind === 'group' || m.text === undefined || cleanText(m.text) !== '')

const ZERO_QUANTITY = /^0(?:[.,]0+)?\s/

function build(
  node: Obj,
  sources: ImportSources,
  crumbs: readonly string[],
  requireContent: boolean,
): ImportedRecipe | null {
  const title = clip(cleanRecipeTitle(cleanText(node['name']) || cleanText(sources.meta['og:title'])), 200)
  if (!title) return null

  const marks = usableMarks(sources.ingredientMarks ?? [])
  const rowTexts = marks.flatMap((m) => (m.kind === 'row' ? [cleanText(m.text)] : []))
  const htmlRows = rowTexts.length >= 2 && rowTexts.every(Boolean)
  let lines = ingredientLines(node['recipeIngredient'] ?? node['ingredients'])
  if (htmlRows && lines.length !== rowTexts.length) {
    // JSON-LD ingrediencie sú zlepené alebo neúplné: riadky z HTML sú spoľahlivejšie.
    lines = rowTexts
  } else if (htmlRows) {
    // Web zaokrúhlil množstvo v JSON-LD na nulu („0 kocky“), v HTML je presné („0.5 kocky“).
    lines = lines.map((line, i) =>
      ZERO_QUANTITY.test(line) && /^\d/.test(rowTexts[i]!) ? rowTexts[i]! : line,
    )
  }
  const groups = assignIngredientGroups(lines.length, marks)
  const ingredients = lines
    .map((line, index) => ({ parsed: parseIngredientLine(line), group: groups?.[index] ?? null }))
    .filter(({ parsed }) => parsed.name)
    .map(({ parsed: i, group }) => ({
      name: clip(i.name, 120),
      quantity: i.quantity,
      unit: i.unit,
      note: i.note ? clip(i.note, 200) : null,
      isOptional: false,
      ...(group ? { groupName: group } : {}),
    }))
  const steps = splitLongStep(flattenInstructions(node['recipeInstructions']).map(stripStepNumber)).map(
    (text) => ({ text: clip(text, 5000) }),
  )
  if (requireContent && ingredients.length === 0 && steps.length === 0) return null

  const yieldValue = parseYield(node['recipeYield'])
  const prep = parseIsoDuration(node['prepTime'])
  const cook = parseIsoDuration(node['cookTime'])
  const total = parseIsoDuration(node['totalTime'])
  const description = clip(cleanText(node['description']) || cleanText(sources.meta['og:description']), 5000)

  const warnings: string[] = []
  if (yieldValue === null) warnings.push('Počet porcií sa nenašiel, nastavili sme 4.')
  if (ingredients.length === 0) warnings.push('Ingrediencie sa nenašli, doplň ich ručne.')
  if (steps.length === 0) warnings.push('Postup sa nenašiel, doplň ho ručne.')

  const recipe: RecipeInputRaw = {
    title,
    description: description || null,
    category:
      matchCategory(node['recipeCategory']) ??
      matchCategory(keywordList(node['keywords'])) ??
      matchCategory([...crumbs]) ??
      matchTitleCategory(title) ??
      'hlavne',
    servings: yieldValue ?? 4,
    prepMinutes: prep,
    cookMinutes: prep === null && cook === null ? total : cook,
    sourceUrl: sources.sourceUrl,
    tags: splitKeywords(node['keywords']),
    ingredients,
    steps,
  }
  const image = absoluteUrl(firstImage(node['image']) ?? sources.meta['og:image'] ?? null, sources.sourceUrl)
  return { recipe, imageUrl: image, warnings }
}

/** Zloží pseudo-uzol zo značiek microdata, aby sa dal spracovať rovnako ako JSON-LD. */
function microdataNode(microdata: ImportSources['microdata']): Obj {
  const all = (...props: string[]) => microdata.filter((m) => props.includes(m.prop)).map((m) => m.value)
  const first = (...props: string[]) => all(...props)[0]
  return {
    name: first('name'),
    description: first('description'),
    image: first('image'),
    recipeYield: first('recipeYield'),
    prepTime: first('prepTime'),
    cookTime: first('cookTime'),
    totalTime: first('totalTime'),
    recipeCategory: first('recipeCategory'),
    keywords: all('keywords'),
    recipeIngredient: all('recipeIngredient', 'ingredients'),
    recipeInstructions: all('recipeInstructions'),
  }
}

/**
 * Recept zo stránky: najprv JSON-LD, potom microdata; `og:*` len dopĺňa názov, popis a fotku.
 * Ak sa recept nenájde (alebo microdata nemá ani ingrediencie, ani postup), vráti null.
 */
export function extractRecipe(sources: ImportSources): ImportedRecipe | null {
  const blocks = sources.jsonLd.map(parseJsonLenient)
  const crumbs = blocks.flatMap((block) => breadcrumbNames(block))
  for (const parsed of blocks) {
    if (!parsed) continue
    const node = findRecipe(parsed)
    const result = node ? build(node, sources, crumbs, false) : null
    if (result) return result
  }
  return build(microdataNode(sources.microdata), sources, crumbs, true)
}
