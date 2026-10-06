import type { ImportRecipeResultDto } from '../../shared/api'
import { extractRecipe, type ImportSources, type IngredientMark } from '../../shared/import/schemaOrg'
import { MAX_IMAGE_BYTES } from '../../shared/recipes'
import { normalizeText } from '../../shared/text'
import type { Db } from '../db/client'
import type { UserRow } from '../env'
import { HttpError } from '../errors'
import { storeImage } from './images'

/** Každý importovaný recept dostane tento tag, aby sa dali recepty z webu nájsť na jednom mieste. */
export const IMPORT_TAG = 'Z internetu'

const MAX_PAGE_BYTES = 2 * 1024 * 1024
const MAX_REDIRECTS = 4
const TIMEOUT_MS = 8000
// Bežné prehliadačové hlavičky: väčšina receptových webov inak vráti prázdnu stránku alebo 403.
const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'accept-language': 'sk,cs;q=0.9,en;q=0.8',
}

/**
 * Zakáže lokálne a privátne adresy, aby import nešiel použiť na skúmanie siete.
 * Adresa sa najprv zjednotí cez URL parser (2130706433 aj 0x7f000001 sú 127.0.0.1).
 */
export function isForbiddenHost(host: string): boolean {
  let name: string
  try {
    name = new URL(`http://${host}/`).hostname.toLowerCase()
  } catch {
    return true
  }
  if (name === 'localhost' || /\.(localhost|local|internal|lan|home)$/.test(name)) return true

  if (name.startsWith('[')) {
    const ip = name.slice(1, -1)
    // ::1, ::, fe80::/10 (link-local), fc00::/7 (unique local), ::ffff:a.b.c.d (IPv4 v IPv6)
    return /^(::1?|fe[89ab][0-9a-f]?:.*|f[cd][0-9a-f]{2}:.*|::ffff:.*)$/.test(ip)
  }

  const v4 = name.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    )
  }
  return false
}

function checkUrl(url: URL): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(422, 'forbidden_host', 'Povolené sú len webové adresy (http a https).')
  }
  if (url.username || url.password || isForbiddenHost(url.hostname)) {
    throw new HttpError(422, 'forbidden_host', 'Z tejto adresy sa recept nedá načítať.')
  }
}

const fetchFailed = (message: string) => new HttpError(502, 'fetch_failed', message)
const tooLarge = () => new HttpError(422, 'too_large', 'Stránka je príliš veľká na načítanie.')

/** Prečíta telo odpovede najviac do `max` bajtov; po prekročení zruší sťahovanie. */
async function readLimited(res: Response, max: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > max) throw tooLarge()
  if (!res.body) return new Uint8Array()
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel()
      throw tooLarge()
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

interface Fetched {
  bytes: Uint8Array
  contentType: string
  finalUrl: string
}

/** GET so zastavením pri privátnych adresách (aj po presmerovaní), s časovým limitom a limitom veľkosti. */
async function fetchLimited(
  fetchFn: typeof fetch,
  start: URL,
  accept: string,
  maxBytes: number,
): Promise<Fetched> {
  let url = start
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    checkUrl(url)
    let res: Response
    try {
      res = await fetchFn(url.href, {
        redirect: 'manual',
        headers: { ...BROWSER_HEADERS, accept },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw fetchFailed('Stránku sa nepodarilo načítať. Skontroluj adresu alebo to skús neskôr.')
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) throw fetchFailed('Stránka vrátila neplatné presmerovanie.')
      try {
        url = new URL(location, url)
      } catch {
        throw fetchFailed('Stránka vrátila neplatné presmerovanie.')
      }
      continue
    }
    if (!res.ok) {
      throw fetchFailed(
        `Stránka odpovedala chybou ${res.status}, možno blokuje automatické čítanie. Recept môžeš prepísať ručne.`,
      )
    }
    return {
      bytes: await readLimited(res, maxBytes),
      contentType: res.headers.get('content-type') ?? '',
      finalUrl: url.href,
    }
  }
  throw fetchFailed('Stránka má príliš veľa presmerovaní.')
}

const WANTED_PROPS = new Set([
  'name',
  'description',
  'image',
  'recipeyield',
  'preptime',
  'cooktime',
  'totaltime',
  'recipecategory',
  'keywords',
  'recipeingredient',
  'ingredients',
  'recipeinstructions',
])
const CANONICAL_PROPS: Readonly<Record<string, string>> = {
  recipeyield: 'recipeYield',
  preptime: 'prepTime',
  cooktime: 'cookTime',
  totaltime: 'totalTime',
  recipecategory: 'recipeCategory',
  recipeingredient: 'recipeIngredient',
  recipeinstructions: 'recipeInstructions',
}

/**
 * Značky skupín a riadkov ingrediencií známych webov: varecha.pravda.sk (`recipe-ingredients__*`) a WP Recipe Maker
 * (`wprm-recipe-*`). JSON-LD skupiny nenesie, preto sa čítajú z HTML.
 */
const GROUP_SELECTOR = [
  '.recipe-ingredients__group', // varecha.pravda.sk
  '.wprm-recipe-group-name', // WP Recipe Maker
  '.ingredients-title', // recepty.aktuality.sk, dobruchut.aktuality.sk
  '.ingredients .key-value h3', // najrecept.topky.sk
  '.ing h2', // kuchynalidla.sk
].join(', ')
const ROW_SELECTOR = [
  '.recipe-ingredients__row',
  '.wprm-recipe-ingredient',
  '.ingredient-item',
  '.ingredients .key-value .value',
  '.ing li',
  '.ing p',
].join(', ')

/** Z HTML vytiahne JSON-LD, og: meta a hodnoty `itemprop` pomocou HTMLRewriter. */
async function collectSources(
  html: Uint8Array,
  contentType: string,
  sourceUrl: string,
): Promise<ImportSources> {
  const jsonLd: string[] = []
  const meta: Record<string, string> = {}
  const microdata: ImportSources['microdata'] = []
  let ldBuffer = ''
  const open: { prop: string; text: string }[] = []
  const marks: IngredientMark[] = []
  let openGroup: { kind: 'group'; text: string } | null = null
  let openRow: { kind: 'row'; text: string } | null = null

  const rewriter = new HTMLRewriter()
    .on('script[type="application/ld+json"]', {
      text(chunk) {
        ldBuffer += chunk.text
        if (chunk.lastInTextNode) {
          jsonLd.push(ldBuffer)
          ldBuffer = ''
        }
      },
    })
    .on('meta[property^="og:"]', {
      element(el) {
        const property = el.getAttribute('property')?.toLowerCase()
        const content = el.getAttribute('content')
        if (property && content && !(property in meta)) meta[property] = content
      },
    })
    .on(GROUP_SELECTOR, {
      element(el) {
        const mark: { kind: 'group'; text: string } = { kind: 'group', text: '' }
        marks.push(mark)
        openGroup = mark
        el.onEndTag(() => {
          if (openGroup === mark) openGroup = null
          mark.text = mark.text.replace(/\s+/g, ' ').trim()
        })
      },
      text(chunk) {
        if (openGroup) openGroup.text += chunk.text
      },
    })
    .on(ROW_SELECTOR, {
      element(el) {
        const mark: { kind: 'row'; text: string } = { kind: 'row', text: '' }
        marks.push(mark)
        openRow = mark
        el.onEndTag(() => {
          if (openRow === mark) openRow = null
          mark.text = mark.text.replace(/\s+/g, ' ').trim()
        })
      },
      text(chunk) {
        if (openRow) openRow.text += chunk.text
      },
    })
    .on('[itemprop]', {
      element(el) {
        const raw = el.getAttribute('itemprop')?.trim() ?? ''
        const key = raw.toLowerCase()
        if (!WANTED_PROPS.has(key)) return
        const prop = CANONICAL_PROPS[key] ?? raw
        const fromAttribute =
          el.getAttribute('content') ??
          el.getAttribute('datetime') ??
          (el.tagName === 'img' ? el.getAttribute('src') : null) ??
          (el.tagName === 'meta' ? '' : null)
        if (fromAttribute !== null) {
          if (fromAttribute.trim()) microdata.push({ prop, value: fromAttribute })
          return
        }
        const entry = { prop, text: '' }
        open.push(entry)
        el.onEndTag(() => {
          open.splice(open.indexOf(entry), 1)
          const value = entry.text.replace(/\s+/g, ' ').trim()
          if (value) microdata.push({ prop, value })
        })
      },
      text(chunk) {
        const innermost = open[open.length - 1]
        if (innermost) innermost.text += chunk.text
      },
    })

  await rewriter.transform(new Response(html, { headers: { 'content-type': contentType } })).arrayBuffer()
  return { jsonLd, meta, microdata, ingredientMarks: marks, sourceUrl }
}

export interface ImportContext {
  fetchFn: typeof fetch
  db: Db
  bucket: R2Bucket
  user: Pick<UserRow, 'id' | 'householdId'>
}

/** Stiahne stránku, nájde recept a (ak sa dá) uloží jeho fotku do domácnosti. */
export async function importRecipe(ctx: ImportContext, rawUrl: string): Promise<ImportRecipeResultDto> {
  const page = await fetchLimited(
    ctx.fetchFn,
    new URL(rawUrl),
    'text/html,application/xhtml+xml',
    MAX_PAGE_BYTES,
  )
  if (!/html|xml/i.test(page.contentType)) {
    throw new HttpError(422, 'not_html', 'Adresa nevedie na webovú stránku s receptom.')
  }

  const sources = await collectSources(page.bytes, page.contentType, page.finalUrl)
  const extracted = extractRecipe(sources)
  if (!extracted) {
    throw new HttpError(
      422,
      'no_recipe',
      'Na tejto stránke sme nenašli recept. Skús iný odkaz alebo recept prepíš ručne.',
    )
  }

  const warnings = [...extracted.warnings]
  let cover: { id: string; url: string } | null = null
  if (extracted.imageUrl) {
    try {
      const image = await fetchLimited(ctx.fetchFn, new URL(extracted.imageUrl), 'image/*', MAX_IMAGE_BYTES)
      cover = await storeImage(ctx.db, ctx.bucket, ctx.user, image.bytes)
    } catch {
      warnings.push('Fotku receptu sa nepodarilo stiahnuť.')
    }
  }

  return {
    recipe: {
      ...extracted.recipe,
      coverImageId: cover?.id ?? null,
      tags: [
        IMPORT_TAG,
        ...(extracted.recipe.tags ?? []).filter((t) => normalizeText(t) !== normalizeText(IMPORT_TAG)),
      ],
    },
    coverImageUrl: cover?.url ?? null,
    warnings,
  }
}
